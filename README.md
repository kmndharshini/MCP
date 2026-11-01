# Google Workspace MCP Server (Gmail & Google Docs)

A Model Context Protocol (MCP) server that exposes two core Google Workspace actions to AI assistants:
1. **`send_email`**: Send plain-text emails via your personal or workspace Gmail account using the official Gmail API.
2. **`append_to_google_doc`**: Append text to the end of an existing Google Doc without modifying or deleting existing content using the official Google Docs API.

Compatible with **Google Antigravity**, **Claude Desktop**, and any MCP client supporting the `stdio` transport.

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Step 1: Google Cloud Project & OAuth Setup](#step-1-google-cloud-project--oauth-setup)
- [Step 2: Installation](#step-2-installation)
- [Step 3: Authorize Google Account](#step-3-authorize-google-account)
- [Step 4: Build and Test](#step-4-build-and-test)
- [Step 5: Connect to MCP Clients](#step-5-connect-to-mcp-clients)
  - [Google Antigravity](#google-antigravity-integration)
  - [Claude Desktop](#claude-desktop-integration)
- [Available MCP Tools](#available-mcp-tools)
  - [1. `send_email`](#1-send_email)
  - [2. `append_to_google_doc`](#2-append_to_google_doc)
- [Security & Best Practices](#security--best-practices)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Standard MCP Stdio Transport**: JSON-RPC communication strictly over `stdin`/`stdout`.
- **Clean Protocol Separation**: Diagnostic logging routed exclusively to `process.stderr`, eliminating JSON-RPC parsing corruption.
- **Principle of Least Privilege**:
  - `https://www.googleapis.com/auth/gmail.send` (send only, no inbox reading/deletion)
  - `https://www.googleapis.com/auth/documents` (edit documents)
- **Automatic Token Refresh**: Transparently updates access tokens using refresh tokens through `google-auth-library` and persists them to disk.
- **Robust Schema Validation**: Powered by `zod` for strict runtime parameter validation.
- **Full Unit & Protocol Test Suite**: Verified against mock Google API fixtures with zero test failures.

---

## Architecture Overview

See [architecture.md](file:///d:/MCP%20Server/architecture.md) for the complete design specification, sequence diagrams, and module contracts.

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm**: `v8.0.0` or higher
- A standard Google / Gmail account

---

## Step 1: Google Cloud Project & OAuth Setup

Follow these steps once to obtain your OAuth 2.0 Client credentials:

1. **Open Google Cloud Console**: Navigate to [https://console.cloud.google.com/](https://console.cloud.google.com/).
2. **Create a Project**:
   - Click the project dropdown at the top and select **New Project**.
   - Name it (e.g., `Google Workspace MCP`) and click **Create**.
3. **Enable Required APIs**:
   - Navigate to **APIs & Services > Library**.
   - Search for **Gmail API** and click **Enable**.
   - Search for **Google Docs API** and click **Enable**.
4. **Configure OAuth Consent Screen**:
   - Navigate to **APIs & Services > OAuth consent screen**.
   - Select **External** user type and click **Create**.
   - Fill in:
     - App name: `Workspace MCP Server`
     - User support email: your email address
     - Developer contact email: your email address
   - Under **Scopes**, click **Add or Remove Scopes** and add:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/documents`
   - Under **Test Users**, click **+ Add Users** and add your Google email address.
   - Click **Save and Continue**.
5. **Create OAuth Client ID**:
   - Navigate to **APIs & Services > Credentials**.
   - Click **+ Create Credentials > OAuth client ID**.
   - Application type: **Desktop app** (or **Web application** with Authorized redirect URI: `http://localhost:3000/oauth2callback`).
   - Name: `Workspace MCP Client`.
   - Click **Create**.
6. **Download Credentials**:
   - Click the download icon (⬇️) next to your newly created OAuth Client ID.
   - Rename the downloaded file to `credentials.json`.
   - Move `credentials.json` into the root directory of this project (`d:/MCP Server/credentials.json`).

---

## Step 2: Installation

Clone or open the repository and install dependencies:

```bash
cd "d:/MCP Server"
npm install
```

Copy the example environment configuration (optional if using `credentials.json` directly):

```bash
cp .env.example .env
```

---

## Step 3: Authorize Google Account

Run the interactive setup helper:

```bash
npm run auth
```

1. The script starts a local callback listener on `http://localhost:3000/oauth2callback`.
2. It automatically opens your browser to Google's OAuth consent screen.
3. Review the permissions (`Send email on your behalf`, `View and manage Google Docs`) and click **Allow**.
4. Upon approval, Google redirects back to localhost, the authorization code is exchanged for an access & refresh token, and saved to `token.json`.
5. *(Fallback)* If browser redirect does not work, simply copy the authorization code from your browser and paste it directly into the terminal prompt.

---

## Step 4: Build and Test

### Run Unit and Protocol Tests

The project includes unit tests for schema validation, RFC 2822 formatting, index calculation, and error simulation:

```bash
npm test
```

### Build the Production Bundle

Compile TypeScript into `dist/`:

```bash
npm run build
```

---

## Step 5: Connect to MCP Clients

### Google Antigravity Integration

You can register this MCP server globally for all Antigravity sessions or locally for your workspace.

#### Global Configuration
Open or create `C:\Users\<YourUsername>\.gemini\config\mcp_config.json`:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["d:/MCP Server/dist/index.js"]
    }
  }
}
```

#### Workspace Configuration
Create `.agents/mcp_config.json` inside your project root:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["d:/MCP Server/dist/index.js"]
    }
  }
}
```

Restart Antigravity or open a new conversation. Antigravity will discover the `send_email` and `append_to_google_doc` tools automatically.

---

### Claude Desktop Integration

Add the server to your `claude_desktop_config.json` (located at `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["d:\\MCP Server\\dist\\index.js"]
    }
  }
}
```

Restart Claude Desktop to use the tools.

---

## Available MCP Tools

### 1. `send_email`

Sends an email using the authenticated Gmail account.

#### Input Schema

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `to` | string | Yes | Recipient email address (e.g. `colleague@example.com`). Multiple addresses can be comma-separated. |
| `subject` | string | Yes | Subject of the email (must not be empty). |
| `body` | string | Yes | Plain-text email body. |
| `cc` | string | No | Optional CC recipient email address(es). |

#### Example Invocation

```json
{
  "to": "partner@example.com",
  "subject": "Project Status Update",
  "body": "Hi team,\n\nThe Google Workspace MCP Server is up and running successfully!",
  "cc": "manager@example.com"
}
```

#### Example Success Output

```json
{
  "success": true,
  "message": "Email sent successfully.",
  "messageId": "18c4b9f2e3a1d07c"
}
```

---

### 2. `append_to_google_doc`

Appends text to the end of an existing Google Doc without replacing or deleting existing content.

#### Input Schema

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `documentId` | string | Yes | The ID of the document (from the Google Docs URL: `https://docs.google.com/document/d/<documentId>/edit`). |
| `content` | string | Yes | The plain-text content to append to the end of the document. |

#### Example Invocation

```json
{
  "documentId": "1a2b3c4d5e6f7g8h9i0j",
  "content": "\n## Action Items\n- Reviewed MCP server architecture.\n- Completed test suite execution.\n"
}
```

#### Example Success Output

```json
{
  "success": true,
  "message": "Content appended to the Google Doc successfully.",
  "documentId": "1a2b3c4d5e6f7g8h9i0j"
}
```

---

## Security & Best Practices

- **Zero Credentials in Git**: `.gitignore` is pre-configured to exclude `credentials.json`, `token.json`, `.credentials/`, and `.env`.
- **Minimum Scopes**: Avoids broad Google Drive or Gmail inbox reading permissions.
- **Automatic Token Rotation**: Long-lived refresh tokens ensure access tokens refresh automatically without user disruption.

---

## Project Structure

```text
d:/MCP Server/
├── docs/
│   └── problemStatement.md     # Original requirements specification
├── src/
│   ├── index.ts                # Server entry point & tool routing
│   ├── config/
│   │   └── index.ts            # Environment and path configurations
│   ├── auth/
│   │   └── googleAuth.ts       # OAuth 2.0 client & token lifecycle manager
│   ├── services/
│   │   ├── gmailService.ts     # RFC 2822 formatting & Gmail API operations
│   │   └── docsService.ts      # Docs structure index calculation & batchUpdate
│   ├── tools/
│   │   ├── sendEmail.ts        # send_email tool definition & Zod validation
│   │   └── appendToDoc.ts      # append_to_google_doc tool definition & Zod validation
│   └── utils/
│       └── logger.ts           # Protocol-safe logging (stderr only)
├── scripts/
│   └── auth-setup.ts           # Interactive browser-based OAuth onboarding script
├── tests/
│   ├── mocks/
│   │   └── googleMocks.ts      # Mock Gmail and Google Docs API fixtures
│   ├── sendEmail.test.ts       # send_email unit tests
│   ├── appendToDoc.test.ts     # append_to_google_doc unit tests
│   ├── auth.test.ts            # Authentication & token storage tests
│   └── mcpProtocol.test.ts     # MCP tools/list and tools/call protocol tests
├── .env.example                # Sample environment variables
├── .gitignore                  # Git ignore protecting secrets and build files
├── package.json                # Project dependencies and npm scripts
├── tsconfig.json               # TypeScript compiler configuration
├── architecture.md             # Complete architecture design document
└── README.md                   # This documentation
```

---

## Troubleshooting

### "Google OAuth tokens not found"
Run `npm run auth` to complete the one-time authorization and generate `token.json`.

### "Google Doc with ID was not found"
- Verify that the `documentId` extracted from the URL is correct.
- Ensure the document is shared with the Google account you authorized during `npm run auth`.

### "Access denied / 403 Forbidden"
- Confirm that the authorized account has **Edit** access to the Google Doc (View-only permissions will fail).
- Verify that both `https://www.googleapis.com/auth/gmail.send` and `https://www.googleapis.com/auth/documents` were consented to.
