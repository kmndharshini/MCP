import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getAuthenticatedClient } from '../auth/googleAuth.js';
import { logger } from '../utils/logger.js';

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  messageId?: string;
}

/**
 * Encodes a string into an RFC 2047 MIME encoded-word if it contains non-ASCII characters.
 */
export function encodeMimeHeader(text: string): string {
  // Check for non-ASCII characters
  if (/[\u0080-\uFFFF]/.test(text)) {
    const encoded = Buffer.from(text, 'utf-8').toString('base64');
    return `=?UTF-8?B?${encoded}?=`;
  }
  return text;
}

/**
 * Builds an RFC 2822 compliant email message.
 */
export function buildRfc2822Message(params: SendEmailParams): string {
  const headers: string[] = [
    'From: me',
    `To: ${params.to}`,
  ];

  if (params.cc && params.cc.trim().length > 0) {
    headers.push(`Cc: ${params.cc.trim()}`);
  }

  headers.push(`Subject: ${encodeMimeHeader(params.subject)}`);
  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/plain; charset=utf-8');
  headers.push('Content-Transfer-Encoding: 8bit');

  return `${headers.join('\r\n')}\r\n\r\n${params.body}`;
}

/**
 * Encodes an RFC 2822 message to URL-safe Base64 format as required by the Gmail API.
 */
export function encodeBase64Url(message: string): string {
  return Buffer.from(message, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Service to handle Gmail API operations.
 */
export class GmailService {
  private client?: OAuth2Client;
  private gmailClient?: gmail_v1.Gmail;

  constructor(client?: OAuth2Client, gmailClient?: gmail_v1.Gmail) {
    this.client = client;
    this.gmailClient = gmailClient;
  }

  private getClient(): gmail_v1.Gmail {
    if (this.gmailClient) {
      return this.gmailClient;
    }
    const auth = this.client || getAuthenticatedClient();
    return google.gmail({ version: 'v1', auth });
  }

  /**
   * Sends a plain-text email using the authenticated user's Gmail account.
   */
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    logger.info(`Sending email to ${params.to} with subject "${params.subject}"`);

    try {
      const rfc2822 = buildRfc2822Message(params);
      const encodedRaw = encodeBase64Url(rfc2822);

      const gmail = this.getClient();
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedRaw,
        },
      });

      const messageId = response.data.id || undefined;
      logger.info(`Email sent successfully. Message ID: ${messageId}`);

      return {
        success: true,
        message: 'Email sent successfully.',
        messageId,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('Gmail API send error:', errorMsg);

      // Inspect for common Google API error structures
      const gError = err as { code?: number; errors?: Array<{ message: string; reason: string }> };
      if (gError.code === 401) {
        throw new Error('Gmail authentication failed or token expired. Please run "npm run auth" to re-authenticate.');
      }
      if (gError.code === 403) {
        throw new Error('Insufficient permissions to send email. Verify that https://www.googleapis.com/auth/gmail.send is granted in your OAuth consent.');
      }

      throw new Error(`Failed to send email via Gmail API: ${errorMsg}`);
    }
  }
}

export const gmailService = new GmailService();
