# CursorPulse

![CI](https://github.com/charlessachet/cursor-pulse/actions/workflows/ci.yml/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-90.09%25-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![VS%20Code%20API](https://img.shields.io/badge/VS%20Code%20API-1.96-blue)

CursorPulse is a private, local-first Cursor/VS Code extension that shows Cursor usage in the status bar with a simple personal-first UX.

It supports both:

- request-based personal usage
- dollar-based team-backed usage when Cursor exposes billing through team endpoints

V1 tracks:

- included usage
- extra paid usage
- derived activity beyond the included quota
- today-by-model usage when Cursor exposes filtered usage history events

It does not try to estimate Cursor's private internal compute cost.

## Current Scope

CursorPulse V1 is intentionally small and local:

- private/local install flow, not public marketplace distribution
- personal-first setup with automatic team-backed usage fallback
- secure session token storage in extension secret storage
- one status bar item
- one tooltip with usage details
- manual refresh
- automatic polling
- stale/auth/error states
- today usage from filtered history events when Cursor exposes them

Not in V1:

- team mode
- notifications
- local history
- charts
- marketplace publishing

## Requirements

You need all of the following installed locally:

- Node.js `20+`
- npm `10+`
- Cursor or VS Code with extension development support

The extension currently targets:

- VS Code API `^1.96.0`
- TypeScript `^5.8.2`

## Install Dependencies

From the project root:

```bash
cd /Users/charlessachet/Workspace/cursor-pulse
npm install
```

## Project Structure

```text
cursor-pulse/
  src/
    extension.ts
    client/
    services/
    ui/
    infra/
    commands/
  test/
    fixtures/
    suite/
  package.json
  tsconfig.json
  README.md
```

## Local Development

Compile once:

```bash
npm run compile
```

Watch TypeScript changes:

```bash
npm run watch
```

Run the extension in Cursor or VS Code:

1. Open `/Users/charlessachet/Workspace/cursor-pulse`
2. Run `npm install`
3. Run `npm run compile`
4. Press `F5` or use the `Run CursorPulse` launch config
5. A new Extension Development Host window will open

## Install It Permanently

If you want CursorPulse on another laptop, including a company laptop, you do not need to run it in a separate dev window.

Build a local install file:

```bash
npm install
npm run package:vsix
```

That creates a `.vsix` file in the project folder.

Then on the other laptop:

1. Copy the `.vsix` file over
2. Open Cursor
3. Open the Extensions view
4. Click the `...` menu
5. Choose `Install from VSIX...`
6. Select the file

After that, CursorPulse stays installed like a normal extension until you uninstall it.

Important:

- you will need to set the session token again on that laptop
- company IT policy may block custom extensions or browser-cookie-based tools
- this is the simplest path for a permanent local install

## Tests

Run the test suite:

```bash
npm test
```

Generate a coverage report:

```bash
npm run test:coverage
```

Run the extension-host smoke test separately:

```bash
npm run test:extension
```

The current tests cover:

- session token parsing
- command handlers
- Cursor API client fetch flow
- diagnostics, scheduler, and secret storage
- usage mapping from redacted fixtures
- stale/auth refresh handling
- status bar rendering
- tooltip rendering
- extension command registration smoke test

Current unit coverage:

- `67` passing unit tests
- `90.09%` statement coverage across unit-testable runtime files
- `100%` statement coverage for the command layer

## Quick Setup

For normal use:

1. Install CursorPulse in Cursor
2. Click `CursorPulse: connect` or run `CursorPulse: Set Session Token`
3. Copy your `WorkosCursorSessionToken` from `cursor.com`
4. Paste it into the prompt
5. CursorPulse starts polling automatically
6. If Cursor exposes your account through team billing endpoints, CursorPulse will use those values automatically

## Setup In Cursor

After launching the extension host:

1. Open the command palette
2. Run `CursorPulse: Set Session Token`
3. CursorPulse opens `https://www.cursor.com/settings`
4. Find the cookie:
   - Chrome / Arc / Brave: open DevTools, then `Application` → `Cookies` → `https://www.cursor.com`
   - Safari: enable the Develop menu first, then open Web Inspector and go to `Storage` → `Cookies`
5. Copy the cookie named `WorkosCursorSessionToken`
6. Paste either:
   - the raw `WorkosCursorSessionToken` value, or
   - a full `Cookie` header/string containing `WorkosCursorSessionToken=...`
7. Paste it into the secure input prompt

CursorPulse stores only the parsed token in VS Code secret storage.

## Configuration

Available settings:

### `cursorPulse.pollMinutes`

- Default: `15`
- How often CursorPulse refreshes usage data

### `cursorPulse.displayMode`

- Default: `"compact"`
- Only compact mode is supported in V1

### `cursorPulse.showUnlimitedActivity`

- Default: `true`
- Shows or hides derived activity metrics in the tooltip

### `cursorPulse.showModelAnalytics`

- Default: `true`
- Shows or hides the tooltip's today-by-model summary when Cursor returns event-level usage data

### `cursorPulse.warningThresholdSpend`

- Default: `0.8`
- Warning threshold for extra spend as a fraction of the spend limit

### `cursorPulse.warningThresholdIncluded`

- Default: `0.1`
- Warning threshold for included quota remaining as a fraction of included quota

## Commands

- `CursorPulse: Set Session Token`
- `CursorPulse: Clear Session Token`
- `CursorPulse: Refresh`
- `CursorPulse: Open Settings`
- `CursorPulse: Export Diagnostics`

## Status Bar States

Examples:

- healthy: `◈ 247 | $1.52`
- warning: `▲ 28 | $84.20`
- critical: `◆ 0 | $150.00`
- dollar-based team usage: `◆ $0 | $1,040.16`
- missing token: `CursorPulse: connect`
- loading: `CursorPulse: syncing`
- auth error: `CursorPulse: reconnect`
- fetch/parsing failure without cache: `CursorPulse: unavailable`

## How CursorPulse Works

The extension uses a stored Cursor session token to call Cursor's current internal web endpoints for usage data.

To stay low-noise, CursorPulse:

- reuses the last successful snapshot on startup when available
- waits for the normal polling interval instead of always refreshing immediately on launch
- retries automatically only after transient network failures
- exports diagnostics only when you explicitly request them

Current fetch flow:

1. `GET /api/auth/me`
2. `GET /api/usage`
3. `POST /api/dashboard/get-hard-limit`
4. `POST /api/dashboard/get-monthly-invoice`
5. Try `POST /api/dashboard/teams`
6. Try `POST /api/dashboard/team`
7. Try `POST /api/dashboard/get-team-spend`
8. Try `POST /api/dashboard/get-filtered-usage-events` for today-only history rows

If team-backed usage is available, CursorPulse prefers those included/spend values. Otherwise it falls back to the personal usage responses.

For some team-billed accounts, Cursor may expose included and on-demand usage in dollars instead of request counts. In that case, CursorPulse shows money-based included usage and can label on-demand spend as unlimited when Cursor does not return a hard cap.

When Cursor returns invoice usage events, the tooltip also shows:

- top model rows for today
- total usage for today
- average daily usage across the current billing cycle

For team-backed accounts that expose the history endpoint, CursorPulse also uses filtered usage events for a real today-only breakdown.

If Cursor does not return usable event-level usage data for your account, CursorPulse shows a short unavailable message instead of guessing.

The raw responses are normalized into a single internal snapshot model before the UI renders.

## Security Notes

- The session token is treated like a password
- The token is stored only in extension secret storage
- CursorPulse should never log the token
- `CursorPulse: Clear Session Token` removes the stored token

## Known Limitations

- Cursor's internal endpoints may change without notice
- Session lifetime is not documented publicly, so auth expiry is handled reactively
- team setup is not exposed as a separate user-facing mode yet; team-backed values are auto-detected when possible
- "Unlimited" usage is treated as activity volume, not guaranteed internal dollar cost

## Troubleshooting

### `CursorPulse: connect`

No token is stored yet. Run `CursorPulse: Set Session Token`.

### `CursorPulse: reconnect`

Your session is likely expired or invalid. Run `CursorPulse: Set Session Token` again.

### `CursorPulse: unavailable`

CursorPulse could not fetch or parse the latest response and had no cached snapshot to show.

### Stale data in tooltip

CursorPulse keeps the last successful snapshot if refresh fails after a prior success.

### Export diagnostics

If the numbers still look wrong, run `CursorPulse: Export Diagnostics`.

That creates a local JSON file with:

- the current CursorPulse state
- the last successful normalized snapshot
- the last raw Cursor payload CursorPulse saw
- the last refresh error, if there was one

Sensitive fields such as tokens, cookies, email, name, `sub`, and `userId` are redacted automatically.

## Keeping This README Accurate

Whenever you change:

- `package.json` scripts, settings, commands, or engine requirements
- the token setup flow
- the endpoint fetch flow
- the project structure
- V1/V2 scope boundaries

update this README in the same change.
