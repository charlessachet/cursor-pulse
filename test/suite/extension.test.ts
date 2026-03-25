import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('extension smoke', () => {
  test('registers CursorPulse commands', async () => {
    const extension = vscode.extensions.getExtension('local.cursor-pulse');
    if (extension) {
      await extension.activate();
    }

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('cursorPulse.setSessionToken'));
    assert.ok(commands.includes('cursorPulse.clearSessionToken'));
    assert.ok(commands.includes('cursorPulse.refresh'));
    assert.ok(commands.includes('cursorPulse.openSettings'));
  });
});
