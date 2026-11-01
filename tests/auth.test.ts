import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  getClientCredentials,
  saveTokens,
  loadStoredTokens,
  getAuthenticatedClient,
  resetCachedClient,
} from '../src/auth/googleAuth.js';
import { config } from '../src/config/index.js';

test('Google Auth - getClientCredentials throws descriptive error when missing', () => {
  // Ensure env is clean for this test
  const origId = config.clientId;
  const origSecret = config.clientSecret;
  config.clientId = undefined;
  config.clientSecret = undefined;

  // Temporary rename credentials file if one exists
  const tempCredsPath = path.resolve(process.cwd(), 'credentials.json.testbak');
  let renamed = false;
  if (fs.existsSync(config.credentialsPath)) {
    fs.renameSync(config.credentialsPath, tempCredsPath);
    renamed = true;
  }

  try {
    assert.throws(
      () => getClientCredentials(),
      /Google OAuth credentials not found/
    );
  } finally {
    if (renamed && fs.existsSync(tempCredsPath)) {
      fs.renameSync(tempCredsPath, config.credentialsPath);
    }
    config.clientId = origId;
    config.clientSecret = origSecret;
  }
});

test('Google Auth - getClientCredentials uses env vars when provided', () => {
  config.clientId = 'test-client-id.apps.googleusercontent.com';
  config.clientSecret = 'test-secret-value';

  try {
    const creds = getClientCredentials();
    assert.strictEqual(creds.clientId, 'test-client-id.apps.googleusercontent.com');
    assert.strictEqual(creds.clientSecret, 'test-secret-value');
  } finally {
    config.clientId = undefined;
    config.clientSecret = undefined;
  }
});

test('Google Auth - token persistence and retrieval', () => {
  const testTokenPath = path.resolve(process.cwd(), 'token.test.json');
  const origTokenPath = config.tokenPath;
  config.tokenPath = testTokenPath;

  const mockTokens = {
    access_token: 'mock-access-token-abc',
    refresh_token: 'mock-refresh-token-xyz',
    scope: 'https://www.googleapis.com/auth/gmail.send',
    token_type: 'Bearer',
    expiry_date: 1999999999999,
  };

  try {
    saveTokens(mockTokens);
    assert.ok(fs.existsSync(testTokenPath));

    const loaded = loadStoredTokens();
    assert.deepStrictEqual(loaded, mockTokens);
  } finally {
    if (fs.existsSync(testTokenPath)) {
      fs.unlinkSync(testTokenPath);
    }
    config.tokenPath = origTokenPath;
  }
});

test('Google Auth - getAuthenticatedClient uses GOOGLE_REFRESH_TOKEN env var (serverless mode)', () => {
  resetCachedClient();
  const origTokenPath = config.tokenPath;
  config.tokenPath = path.resolve(process.cwd(), 'non-existent-token.json');

  config.clientId = 'test-serverless-client-id';
  config.clientSecret = 'test-serverless-secret';
  config.refreshToken = 'test-serverless-refresh-token';

  try {
    const client = getAuthenticatedClient();
    assert.ok(client);
    // Credentials should contain the refresh_token
    assert.strictEqual(client.credentials.refresh_token, 'test-serverless-refresh-token');
  } finally {
    config.tokenPath = origTokenPath;
    config.clientId = undefined;
    config.clientSecret = undefined;
    config.refreshToken = undefined;
    resetCachedClient();
  }
});

