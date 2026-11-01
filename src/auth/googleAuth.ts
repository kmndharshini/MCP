import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

interface GoogleCredentialsJson {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
}

let cachedOAuth2Client: OAuth2Client | null = null;

/**
 * Loads client ID, client secret, and redirect URI from credentials.json or environment variables.
 */
export function getClientCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  // 1. Check if explicit environment variables are provided
  if (config.clientId && config.clientSecret) {
    return {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    };
  }

  // 2. Look for credentials.json file
  if (fs.existsSync(config.credentialsPath)) {
    try {
      const fileData = fs.readFileSync(config.credentialsPath, 'utf-8');
      const parsed: GoogleCredentialsJson = JSON.parse(fileData);
      const creds = parsed.installed || parsed.web;

      if (!creds || !creds.client_id || !creds.client_secret) {
        throw new Error(
          `Invalid credentials format in ${config.credentialsPath}. Expected "installed" or "web" credentials with client_id and client_secret.`
        );
      }

      const redirectUri =
        config.redirectUri ||
        (creds.redirect_uris && creds.redirect_uris.length > 0 ? creds.redirect_uris[0] : 'http://localhost:3000/oauth2callback');

      return {
        clientId: creds.client_id,
        clientSecret: creds.client_secret,
        redirectUri,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read credentials file at ${config.credentialsPath}: ${message}`);
    }
  }

  throw new Error(
    `Google OAuth credentials not found. Please place credentials.json in the project root (${config.credentialsPath}) or configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.`
  );
}

/**
 * Creates and initializes an OAuth2Client instance.
 */
export function createOAuth2Client(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = getClientCredentials();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // Automatically persist refreshed tokens when google-auth-library refreshes them
  oauth2Client.on('tokens', (tokens: Credentials) => {
    logger.info('OAuth token refreshed automatically by Google Auth Library.');
    try {
      let existingTokens: Credentials = {};
      if (fs.existsSync(config.tokenPath)) {
        existingTokens = JSON.parse(fs.readFileSync(config.tokenPath, 'utf-8'));
      }
      const mergedTokens: Credentials = {
        ...existingTokens,
        ...tokens,
      };
      saveTokens(mergedTokens);
    } catch (saveErr) {
      logger.error('Failed to save refreshed token to disk:', saveErr);
    }
  });

  return oauth2Client;
}

/**
 * Saves OAuth2 credentials to the configured token.json path.
 */
export function saveTokens(tokens: Credentials): void {
  const dir = path.dirname(config.tokenPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(config.tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
  logger.info(`Saved OAuth tokens successfully to ${config.tokenPath}`);
}

/**
 * Loads stored tokens from disk if present.
 */
export function loadStoredTokens(): Credentials | null {
  if (!fs.existsSync(config.tokenPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(config.tokenPath, 'utf-8');
    return JSON.parse(raw) as Credentials;
  } catch (err) {
    logger.warn(`Could not read tokens from ${config.tokenPath}:`, err);
    return null;
  }
}

/**
 * Returns an authenticated OAuth2Client ready for making Google API calls.
 * Throws a clear, actionable error if authentication tokens are missing.
 */
export function getAuthenticatedClient(): OAuth2Client {
  if (cachedOAuth2Client) {
    return cachedOAuth2Client;
  }

  const client = createOAuth2Client();

  // 1. Check if refresh token is provided directly via environment variables (e.g. Vercel deployment)
  if (config.refreshToken && config.refreshToken.trim().length > 0) {
    logger.info('Authenticating via GOOGLE_REFRESH_TOKEN environment variable (serverless mode).');
    client.setCredentials({
      refresh_token: config.refreshToken.trim(),
    });
    cachedOAuth2Client = client;
    return cachedOAuth2Client;
  }

  // 2. Fall back to loading tokens from token.json on disk (local development mode)
  const tokens = loadStoredTokens();

  if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
    throw new Error(
      `Google OAuth tokens not found at ${config.tokenPath}. Please run the auth setup command to authorize: "npm run auth", or set GOOGLE_REFRESH_TOKEN in your environment.`
    );
  }

  client.setCredentials(tokens);
  cachedOAuth2Client = client;
  return cachedOAuth2Client;
}

/**
 * Generates the Google OAuth 2.0 consent URL for initial user authorization.
 */
export function generateAuthUrl(oauth2Client?: OAuth2Client): string {
  const client = oauth2Client || createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline', // Requests refresh_token
    prompt: 'consent',     // Forces consent to ensure refresh_token is returned
    scope: config.scopes,
  });
}

/**
 * Exchanges an authorization code for access and refresh tokens, saving them to disk.
 */
export async function exchangeCodeForTokens(code: string, oauth2Client?: OAuth2Client): Promise<Credentials> {
  const client = oauth2Client || createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  saveTokens(tokens);
  cachedOAuth2Client = client;
  return tokens;
}

/**
 * Resets cached client (useful in tests or after re-authentication).
 */
export function resetCachedClient(): void {
  cachedOAuth2Client = null;
}
