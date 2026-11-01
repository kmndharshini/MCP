import http from 'node:http';
import readline from 'node:readline';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  createOAuth2Client,
  getClientCredentials,
} from '../src/auth/googleAuth.js';
import { config } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';

function openBrowser(url: string): void {
  const platform = process.platform;
  let command = '';

  if (platform === 'win32') {
    // Windows 'start' command with empty title argument
    command = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      logger.info('Could not automatically open browser. Please open the URL manually.');
    }
  });
}

function promptManualCode(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\nIf the browser redirect does not work, paste the authorization code here: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runAuthSetup(): Promise<void> {
  console.log('\n======================================================');
  console.log('       Google Workspace MCP Server - OAuth Setup       ');
  console.log('======================================================\n');

  // Verify credentials exist before proceeding
  try {
    getClientCredentials();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\x1b[31mError: ${message}\x1b[0m\n`);
    console.log('To set up Google OAuth 2.0:');
    console.log('1. Visit Google Cloud Console: https://console.cloud.google.com/');
    console.log('2. Create or select a project.');
    console.log('3. Enable "Gmail API" and "Google Docs API" under APIs & Services > Library.');
    console.log('4. Configure OAuth Consent Screen (User Type: External, Add your Google email under "Test Users").');
    console.log('5. Under APIs & Services > Credentials, click "+ Create Credentials" > "OAuth client ID".');
    console.log('   - Application Type: "Desktop app" (or "Web application" with Authorized Redirect URI: http://localhost:3000/oauth2callback)');
    console.log('6. Download the JSON credential file, rename it to "credentials.json", and save it to:');
    console.log(`   ${config.credentialsPath}\n`);
    process.exit(1);
  }

  const oauth2Client = createOAuth2Client();
  const authUrl = generateAuthUrl(oauth2Client);
  const port = config.authServerPort;

  let serverResolved = false;

  const server = http.createServer(async (req, res) => {
    if (serverResolved) return;

    try {
      const reqUrl = new URL(req.url || '', `http://localhost:${port}`);
      if (reqUrl.pathname === '/oauth2callback') {
        const code = reqUrl.searchParams.get('code');
        const error = reqUrl.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
            <h1 style="color:#d93025;">Authorization Failed</h1>
            <p>${error}</p>
          </body></html>`);
          console.error(`\n\x1b[31mAuthorization error received: ${error}\x1b[0m`);
          server.close();
          process.exit(1);
          return;
        }

        if (code) {
          serverResolved = true;
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
            <h1 style="color:#188038;">Authorization Successful!</h1>
            <p>Your Google Workspace credentials have been saved. You may now close this window and return to your terminal.</p>
          </body></html>`);

          console.log('\n\x1b[32mReceived authorization code from Google redirect!\x1b[0m');
          console.log('Exchanging authorization code for tokens...');

          await exchangeCodeForTokens(code, oauth2Client);

          console.log(`\x1b[32mSuccess! Tokens saved to: ${config.tokenPath}\x1b[0m`);
          console.log('\nYour MCP server is now ready to use!');
          console.log('You can start the server with: npm run start\n');

          setTimeout(() => {
            server.close();
            process.exit(0);
          }, 1000);
          return;
        }
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error handling OAuth callback:', msg);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  });

  server.listen(port, () => {
    console.log(`Listening for OAuth callback on http://localhost:${port}/oauth2callback ...\n`);
    console.log('Opening your browser to authorize access to Gmail and Google Docs...');
    console.log('If your browser does not open automatically, visit this URL:\n');
    console.log(`\x1b[36m${authUrl}\x1b[0m\n`);

    openBrowser(authUrl);

    // Fallback: allow manual entry if callback cannot be hit
    promptManualCode().then(async (code) => {
      if (!serverResolved && code) {
        serverResolved = true;
        try {
          console.log('Exchanging authorization code for tokens...');
          await exchangeCodeForTokens(code, oauth2Client);
          console.log(`\x1b[32mSuccess! Tokens saved to: ${config.tokenPath}\x1b[0m`);
          console.log('You can start the server with: npm run start\n');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`\x1b[31mFailed to exchange code: ${msg}\x1b[0m`);
        } finally {
          server.close();
          process.exit(0);
        }
      }
    });
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`\x1b[33mWarning: Port ${port} is in use. Falling back to manual code paste.\x1b[0m`);
      console.log('Please visit the authorization URL:\n');
      console.log(`\x1b[36m${authUrl}\x1b[0m\n`);
      openBrowser(authUrl);

      promptManualCode().then(async (code) => {
        if (code) {
          try {
            await exchangeCodeForTokens(code, oauth2Client);
            console.log(`\x1b[32mSuccess! Tokens saved to: ${config.tokenPath}\x1b[0m`);
          } catch (exchangeErr: unknown) {
            const msg = exchangeErr instanceof Error ? exchangeErr.message : String(exchangeErr);
            console.error(`\x1b[31mFailed to exchange code: ${msg}\x1b[0m`);
          }
        }
        process.exit(0);
      });
    } else {
      console.error('Server error:', err);
    }
  });
}

runAuthSetup().catch((err) => {
  console.error('Fatal auth setup error:', err);
  process.exit(1);
});
