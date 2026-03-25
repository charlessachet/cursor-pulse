import * as assert from 'node:assert/strict';
import mock = require('mock-require');

suite('commands', () => {
  teardown(() => {
    mock.stopAll();
  });

  test('clear token command clears the token and shows a message', async () => {
    const messages: string[] = [];
    mockVscode({
      window: {
        async showInformationMessage(message: string) {
          messages.push(message);
        },
      },
    });

    const { runClearTokenCommand } = mock.reRequire('../../src/commands/clearToken');
    let cleared = false;
    await runClearTokenCommand({
      async clearToken() {
        cleared = true;
      },
    });

    assert.equal(cleared, true);
    assert.deepEqual(messages, ['CursorPulse session token cleared.']);
  });

  test('open settings command opens CursorPulse settings', async () => {
    const commands: Array<{ id: string; arg: string }> = [];
    mockVscode({
      commands: {
        async executeCommand(id: string, arg: string) {
          commands.push({ id, arg });
        },
      },
    });

    const { runOpenSettingsCommand } = mock.reRequire('../../src/commands/openSettings');
    await runOpenSettingsCommand();

    assert.deepEqual(commands, [
      {
        id: 'workbench.action.openSettings',
        arg: 'cursorPulse',
      },
    ]);
  });

  test('set token command saves a parsed token and opens settings', async () => {
    const opened: string[] = [];
    const messages: string[] = [];
    let storedToken: string | undefined;
    let validateInput: ((value: string) => string | null) | undefined;

    mockVscode({
      Uri: {
        parse(value: string) {
          return { value };
        },
      },
      env: {
        async openExternal(uri: { value: string }) {
          opened.push(uri.value);
        },
      },
      window: {
        async showInputBox(options: { validateInput?: (value: string) => string | null }) {
          validateInput = options.validateInput;
          return 'WorkosCursorSessionToken=abc%3A%3Arest';
        },
        async showInformationMessage(message: string) {
          messages.push(message);
        },
      },
    });

    const { runSetTokenCommand } = mock.reRequire('../../src/commands/setToken');
    const saved = await runSetTokenCommand({
      async setToken(token: string) {
        storedToken = token;
      },
    });

    assert.equal(saved, true);
    assert.deepEqual(opened, ['https://www.cursor.com/settings']);
    assert.equal(storedToken, 'abc%3A%3Arest');
    assert.deepEqual(messages, ['CursorPulse session token saved securely.']);
    assert.equal(validateInput?.('invalid token with spaces'), 'Paste a valid token or Cookie header containing WorkosCursorSessionToken.');
    assert.equal(validateInput?.('WorkosCursorSessionToken=abc%3A%3Arest'), null);
  });

  test('set token command returns false when input is cancelled', async () => {
    mockVscode({
      Uri: {
        parse(value: string) {
          return { value };
        },
      },
      env: {
        async openExternal() {},
      },
      window: {
        async showInputBox() {
          return undefined;
        },
      },
    });

    const { runSetTokenCommand } = mock.reRequire('../../src/commands/setToken');
    const saved = await runSetTokenCommand({
      async setToken() {
        throw new Error('should not be called');
      },
    });

    assert.equal(saved, false);
  });

  test('set token command surfaces parse failures cleanly', async () => {
    const errors: string[] = [];
    mockVscode({
      Uri: {
        parse(value: string) {
          return { value };
        },
      },
      env: {
        async openExternal() {},
      },
      window: {
        async showInputBox() {
          return 'invalid token with spaces';
        },
        async showErrorMessage(message: string) {
          errors.push(message);
        },
      },
    });

    const { runSetTokenCommand } = mock.reRequire('../../src/commands/setToken');
    const saved = await runSetTokenCommand({
      async setToken() {
        throw new Error('should not be called');
      },
    });

    assert.equal(saved, false);
    assert.deepEqual(errors, ['CursorPulse could not parse a session token from that input.']);
  });

  test('export diagnostics command writes the report to disk', async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const messages: string[] = [];
    mockVscode({
      Uri: {
        file(fsPath: string) {
          return { fsPath };
        },
      },
      workspace: {
        workspaceFolders: [{ uri: { fsPath: '/tmp/workspace' } }],
        fs: {
          async writeFile(uri: { fsPath: string }, value: Uint8Array) {
            writes.push({
              path: uri.fsPath,
              content: new TextDecoder().decode(value),
            });
          },
        },
      },
      window: {
        async showSaveDialog() {
          return { fsPath: '/tmp/workspace/cursor-pulse-diagnostics.json' };
        },
        async showInformationMessage(message: string) {
          messages.push(message);
        },
      },
    });

    const { runExportDiagnosticsCommand } = mock.reRequire('../../src/commands/exportDiagnostics');
    await runExportDiagnosticsCommand(
      {
        async buildDiagnosticsReport() {
          return { exportedAt: '2026-03-25T00:00:00.000Z', hasToken: true };
        },
      },
      { hasToken: true },
    );

    assert.equal(writes.length, 1);
    assert.equal(writes[0]?.path, '/tmp/workspace/cursor-pulse-diagnostics.json');
    assert.match(writes[0]?.content ?? '', /"hasToken": true/);
    assert.deepEqual(messages, [
      'CursorPulse diagnostics exported to /tmp/workspace/cursor-pulse-diagnostics.json',
    ]);
  });

  test('export diagnostics command exits quietly when save is cancelled', async () => {
    let wrote = false;
    mockVscode({
      Uri: {
        file(fsPath: string) {
          return { fsPath };
        },
      },
      workspace: {
        workspaceFolders: [{ uri: { fsPath: '/tmp/workspace' } }],
        fs: {
          async writeFile() {
            wrote = true;
          },
        },
      },
      window: {
        async showSaveDialog() {
          return undefined;
        },
      },
    });

    const { runExportDiagnosticsCommand } = mock.reRequire('../../src/commands/exportDiagnostics');
    await runExportDiagnosticsCommand(
      {
        async buildDiagnosticsReport() {
          return { exportedAt: '2026-03-25T00:00:00.000Z', hasToken: true };
        },
      },
      { hasToken: true },
    );

    assert.equal(wrote, false);
  });

  test('export diagnostics command falls back to process cwd when no workspace is open', async () => {
    let seenDefaultPath = '';
    mockVscode({
      Uri: {
        file(fsPath: string) {
          return { fsPath };
        },
      },
      workspace: {
        workspaceFolders: undefined,
        fs: {
          async writeFile() {},
        },
      },
      window: {
        async showSaveDialog(options: { defaultUri: { fsPath: string } }) {
          seenDefaultPath = options.defaultUri.fsPath;
          return undefined;
        },
      },
    });

    const { runExportDiagnosticsCommand } = mock.reRequire('../../src/commands/exportDiagnostics');
    await runExportDiagnosticsCommand(
      {
        async buildDiagnosticsReport() {
          return { exportedAt: '2026-03-25T00:00:00.000Z', hasToken: true };
        },
      },
      { hasToken: true },
    );

    assert.match(seenDefaultPath, /cursor-pulse-diagnostics\.json$/);
  });
});

function mockVscode(overrides: Record<string, unknown>): void {
  const base = {
    Uri: {
      file(fsPath: string) {
        return { fsPath };
      },
      parse(value: string) {
        return { value };
      },
    },
    env: {
      async openExternal() {},
    },
    commands: {
      async executeCommand() {},
    },
    workspace: {
      workspaceFolders: [],
      fs: {
        async writeFile() {},
      },
    },
    window: {
      async showInformationMessage() {},
      async showErrorMessage() {},
      async showInputBox() {
        return undefined;
      },
      async showSaveDialog() {
        return undefined;
      },
    },
  };

  mock('vscode', merge(base, overrides));
}

function merge(base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = merge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}
