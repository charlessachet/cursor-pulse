# Publishing CursorPulse to the VS Code Marketplace

Follow these steps to publish your extension to the VS Code Marketplace.

## Prerequisites

1. **Install `vsce`**:
   The Visual Studio Code Extension Manager (`vsce`) is the command-line tool for packaging and publishing extensions.
   You can run it using `npx` (which is already available since you have Node.js/npm installed).

## Step 1: Create a Publisher Account

1. Go to the [Visual Studio Marketplace Management Page](https://marketplace.visualstudio.com/manage).
2. Sign in with a Microsoft account.
3. Create a **Publisher** if you haven't already. Give it an identifier (e.g., `charlessachet`).
4. **Important**: Once you have your Publisher ID, update the `publisher` field in your `package.json` file from `"local"` to your actual Publisher ID.

```json
// in package.json
"publisher": "your-publisher-id-here"
```

## Step 2: Get a Personal Access Token (PAT)

You need an Azure DevOps Personal Access Token (PAT) to let the `vsce` CLI publish the extension on your behalf.

1. Go to [Azure DevOps](https://dev.azure.com/).
2. Sign in with the same account you used for the Marketplace.
3. On your profile settings (top right, the user settings icon next to your avatar), click **Personal access tokens**.
4. Click **New Token**.
5. Give the token a name (e.g., "VS Code Marketplace Publish").
6. Under **Organizations**, select **All accessible organizations**.
7. Under **Scopes**, select **Custom defined**.
8. Scroll down to **Marketplace**, and check **Acquire** and **Manage** (or **Manage** if Acquire is not visible).
9. Click **Create**.
10. **Copy the token and save it somewhere safe**, as you won't be able to see it again!

## Step 3: Login to `vsce`

Open your terminal in the extension's root directory and login with your Publisher ID and PAT:

```bash
npx @vscode/vsce login your-publisher-id-here
```

When prompted, paste the PAT you created in Step 2.

## Step 4: Publish

Once logged in, you can publish the extension to the marketplace:

```bash
npx @vscode/vsce publish
```

This will automatically package your extension into a `.vsix` file and publish it to the Marketplace.
It may take a few minutes for the extension to become visible and searchable in the VS Code Extensions view.

## Updating the Extension Later

When you want to release a new version in the future:
1. Update the `"version"` number in your `package.json` (e.g., change `"0.1.0"` to `"0.1.1"`).
2. Run `npx @vscode/vsce publish` again.
