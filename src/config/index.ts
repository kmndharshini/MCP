import path from 'node:path';
import dotenv from 'dotenv';

// Load environment variables from .env file if available
dotenv.config();

export interface AppConfig {
  credentialsPath: string;
  tokenPath: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  mcpApiSecret?: string;
  redirectUri: string;
  authServerPort: number;
  scopes: string[];
}

const DEFAULT_CREDENTIALS_PATH = path.resolve(process.cwd(), 'credentials.json');
const DEFAULT_TOKEN_PATH = path.resolve(process.cwd(), 'token.json');
const DEFAULT_REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const DEFAULT_PORT = 3000;

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/documents',
];

export const config: AppConfig = {
  credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH
    ? path.resolve(process.cwd(), process.env.GOOGLE_CREDENTIALS_PATH)
    : DEFAULT_CREDENTIALS_PATH,
  tokenPath: process.env.GOOGLE_TOKEN_PATH
    ? path.resolve(process.cwd(), process.env.GOOGLE_TOKEN_PATH)
    : DEFAULT_TOKEN_PATH,
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  mcpApiSecret: process.env.MCP_API_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT_URI,
  authServerPort: process.env.AUTH_SERVER_PORT
    ? parseInt(process.env.AUTH_SERVER_PORT, 10)
    : DEFAULT_PORT,
  scopes: GOOGLE_SCOPES,
};
