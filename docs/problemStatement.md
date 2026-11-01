# Problem Statement: Basic Gmail and Google Docs MCP Server

## 1. Project Overview

Build a basic **Model Context Protocol (MCP) server** that exposes two
Google Workspace actions as MCP tools:

1.  Send an email using the user's Gmail account.
2.  Append new content to an existing Google Doc.

The server will be developed in **Google Antigravity**. An
MCP-compatible AI client should be able to discover these tools, collect
the required inputs, and invoke them.

## 2. Objectives

-   Create a small, easy-to-understand MCP server.
-   Authenticate securely with Google APIs using OAuth 2.0.
-   Expose the Gmail and Google Docs operations as clearly defined MCP
    tools.
-   Return useful success and error messages.
-   Keep the implementation modular so more Google Workspace tools can
    be added later.

## 3. Scope

### In scope

-   Gmail API integration for sending plain-text emails.
-   Google Docs API integration for appending text to an existing
    document.
-   MCP tool definitions with input validation.
-   OAuth 2.0 authentication and token handling.
-   Basic error handling and logging.
-   Local setup instructions and basic tests.

### Out of scope for the first version

-   Reading, searching, deleting, or labeling Gmail messages.
-   Creating new Google Docs.
-   Editing or deleting existing document content.
-   Rich-text formatting, tables, images, and attachments in emails or
    documents.
-   Multi-user authentication, deployment, and production-scale hosting.

## 4. Functional Requirements

### Tool 1: `send_email`

**Purpose:** Send an email from the authenticated user's Gmail account.

**Inputs:**

  Field       Type       Required Description
  ----------- -------- ---------- -----------------------------------------
  `to`        string          Yes Recipient email address.
  `subject`   string          Yes Email subject.
  `body`      string          Yes Plain-text email body.
  `cc`        string           No Optional CC recipient(s), if supported.

**Expected behavior:**

1.  Validate the recipient, subject, and body.
2.  Build a valid RFC 2822 email message and encode it as required by
    the Gmail API.
3.  Call the Gmail API `users.messages.send` endpoint using the
    authenticated user's account.
4.  Return a success response containing the Gmail message ID.
5.  Return a clear, actionable error if validation, authentication,
    authorization, or sending fails.

**Example input:**

``` json
{
  "to": "recipient@example.com",
  "subject": "MCP Server Test",
  "body": "Hello, this email was sent using my MCP server."
}
```

**Example success response:**

``` json
{
  "success": true,
  "message": "Email sent successfully.",
  "messageId": "gmail-message-id"
}
```

### Tool 2: `append_to_google_doc`

**Purpose:** Append plain text to the end of an existing Google Doc.

**Inputs:**

  Field          Type       Required Description
  -------------- -------- ---------- ---------------------------------
  `documentId`   string          Yes ID of the Google Doc to update.
  `content`      string          Yes Text to append to the document.

**Expected behavior:**

1.  Validate that `documentId` and `content` are not empty.
2.  Retrieve the document using the Google Docs API to determine its
    current end index.
3.  Use `documents.batchUpdate` with an `insertText` request to add the
    content at the end of the document.
4.  Do not replace or delete existing document content.
5.  Return a success response or a clear error if the document cannot be
    accessed or updated.

**Example input:**

``` json
{
  "documentId": "YOUR_GOOGLE_DOC_ID",
  "content": "New notes added through the MCP server."
}
```

**Example success response:**

``` json
{
  "success": true,
  "message": "Content appended to the Google Doc successfully.",
  "documentId": "YOUR_GOOGLE_DOC_ID"
}
```

## 5. Non-Functional Requirements

-   **Security:** Never hardcode OAuth client secrets, access tokens, or
    refresh tokens in source code.
-   **Least privilege:** Request only the Google OAuth scopes needed for
    these two actions. Use Gmail send permission and Google Docs edit
    permission; avoid broad mailbox access.
-   **Validation:** Validate all tool inputs before making API calls.
-   **Reliability:** Handle expired tokens, missing permissions, invalid
    document IDs, API errors, and network failures gracefully.
-   **Maintainability:** Keep MCP tool definitions, Google API
    integration, authentication, and configuration logically separated.
-   **Transparency:** Tool responses should clearly state whether an
    operation succeeded or failed. Do not report success unless Google
    confirms the operation.

## 6. Authentication and Configuration

Use Google OAuth 2.0 for a user-authorized Google account.

The implementation should:

1.  Explain how to create a Google Cloud project.
2.  Enable the Gmail API and Google Docs API.
3.  Configure the OAuth consent screen and create OAuth client
    credentials.
4.  Complete the OAuth authorization flow and obtain the required
    tokens.
5.  Store credentials and tokens securely outside source control.
6.  Refresh access tokens when necessary.

Use environment variables or a local, ignored configuration file for
sensitive values. Provide an `.env.example` containing placeholder names
only. Add real credential and token files to `.gitignore`.

Suggested minimum scopes:

-   Gmail: `https://www.googleapis.com/auth/gmail.send`
-   Google Docs: `https://www.googleapis.com/auth/documents`

The user must grant the requested permissions. Explain any Google OAuth
testing-mode or test-user setup needed during local development.

## 7. MCP Server Requirements

-   Use the official MCP SDK for the selected implementation language.
-   Expose the two operations as discoverable MCP tools named exactly:
    -   `send_email`
    -   `append_to_google_doc`
-   Give each tool a clear description and a structured input schema.
-   Return results in a format that an MCP client can understand.
-   Use a local development transport supported by the chosen MCP SDK
    and Antigravity workflow.
-   Keep standard output reserved for MCP protocol communication when
    using stdio transport. Send diagnostic logs to standard error.

## 8. Suggested Project Structure

The exact structure may be adjusted to match the selected language and
MCP SDK.

``` text
google-workspace-mcp/
├── src/
│   ├── index                 # MCP server entry point
│   ├── tools/
│   │   ├── sendEmail         # Gmail tool implementation
│   │   └── appendToDoc       # Google Docs tool implementation
│   ├── services/
│   │   ├── gmailService      # Gmail API operations
│   │   └── docsService       # Google Docs API operations
│   ├── auth/
│   │   └── googleAuth        # OAuth setup and token handling
│   └── config                # Environment/configuration handling
├── tests/
├── .env.example
├── .gitignore
├── package.json              # If using Node.js/TypeScript
└── README.md
```

## 9. Acceptance Criteria

The first version is complete when all the following are true:

-   [ ] The MCP server starts locally without errors.
-   [ ] An MCP client can discover both tools.
-   [ ] Google OAuth authorization works for the configured account.
-   [ ] Calling `send_email` with valid inputs sends an email from the
    authenticated Gmail account.
-   [ ] Calling `append_to_google_doc` with a valid document ID appends
    content to the end of that document.
-   [ ] Existing Google Doc content remains unchanged.
-   [ ] Invalid or missing inputs return clear validation errors.
-   [ ] Google API failures return understandable error messages.
-   [ ] Secrets and tokens are not committed to source control.
-   [ ] A README explains setup, OAuth configuration, running the
    server, connecting it to an MCP client, and testing both tools.

## 10. Test Scenarios

### Gmail

-   Send an email with valid recipient, subject, and body.
-   Reject a missing or malformed recipient.
-   Reject an empty subject or body.
-   Handle an expired or invalid OAuth token.
-   Handle insufficient Gmail permissions and Gmail API errors.

### Google Docs

-   Append text to a valid Google Doc.
-   Verify that the new text appears after the existing content.
-   Reject an empty document ID or empty content.
-   Handle a document ID that does not exist.
-   Handle a document the authenticated user cannot edit.
-   Verify that existing document content is not overwritten.

Use mocked Google API clients for automated tests where practical.
Perform a small number of end-to-end tests with a dedicated test Gmail
account and test Google Doc.

## 11. Instructions for Antigravity

Act as an experienced developer helping build this project
incrementally.

1.  Inspect the workspace and explain the proposed language, MCP SDK,
    dependencies, and project structure before implementation.
2.  Prefer a simple implementation suitable for a beginner learning MCP.
    Avoid unnecessary frameworks and abstractions.
3.  Implement the MCP server and the two tools described in this
    document.
4.  Use official MCP and Google API libraries and current documented
    APIs.
5.  Do not invent credentials or assume OAuth has already been
    configured. Provide step-by-step instructions for obtaining and
    configuring credentials.
6.  Create `.env.example`, `.gitignore`, and a clear `README.md`.
7.  Add input validation and useful error handling.
8.  Add tests, including mocked API tests where practical.
9.  Run the available checks and fix implementation errors.
10. Explain how to register/connect the local MCP server in the MCP
    client configuration used by Antigravity, showing the exact
    configuration for the chosen runtime.
11. Do not claim that an email was sent or a document was updated unless
    the corresponding API call actually succeeds.

**Implementation order:**

-   Phase 1: Initialize the project and make a minimal MCP server that
    starts.
-   Phase 2: Implement and test Google OAuth authentication.
-   Phase 3: Implement `send_email`.
-   Phase 4: Implement `append_to_google_doc`.
-   Phase 5: Connect the server to the MCP client, run end-to-end tests,
    and document the workflow.

## 12. Definition of Done

A user can connect the local MCP server to an MCP-compatible client,
authorize their Google account, and invoke:

-   `send_email` to send a plain-text email through Gmail.
-   `append_to_google_doc` to add plain text to the end of an existing
    Google Doc.

Both actions must work with real Google APIs, respect the user's granted
permissions, and provide clear results.
