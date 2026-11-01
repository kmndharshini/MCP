import { google, docs_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getAuthenticatedClient } from '../auth/googleAuth.js';
import { logger } from '../utils/logger.js';

export interface AppendToDocParams {
  documentId: string;
  content: string;
}

export interface AppendToDocResult {
  success: boolean;
  message: string;
  documentId: string;
}

/**
 * Calculates the valid zero-based/one-based index for appending content at the end of a Google Doc.
 * In the Google Docs API:
 * - A document body contains an array of StructuralElements.
 * - The document always ends with a segment delimiter newline character.
 * - The valid insertion point at the end of the document is `endIndex - 1`.
 * - Inserting at `endIndex` itself will trigger an "Invalid index" error.
 */
export function calculateAppendIndex(document: docs_v1.Schema$Document): number {
  const elements = document.body?.content;
  if (!elements || elements.length === 0) {
    return 1;
  }

  const lastElement = elements[elements.length - 1];
  const endIndex = lastElement.endIndex;

  if (typeof endIndex === 'number' && endIndex > 1) {
    return endIndex - 1;
  }

  return 1;
}

/**
 * Service to handle Google Docs API operations.
 */
export class DocsService {
  private client?: OAuth2Client;
  private docsClient?: docs_v1.Docs;

  constructor(client?: OAuth2Client, docsClient?: docs_v1.Docs) {
    this.client = client;
    this.docsClient = docsClient;
  }

  private getClient(): docs_v1.Docs {
    if (this.docsClient) {
      return this.docsClient;
    }
    const auth = this.client || getAuthenticatedClient();
    return google.docs({ version: 'v1', auth });
  }

  /**
   * Appends plain text to the end of an existing Google Doc.
   */
  async appendToDocument(params: AppendToDocParams): Promise<AppendToDocResult> {
    const { documentId, content } = params;
    logger.info(`Appending text to Google Doc [${documentId}] (Length: ${content.length} characters)`);

    try {
      const docs = this.getClient();

      // Step 1: Retrieve document to get current structure and end index
      const docResponse = await docs.documents.get({
        documentId,
      });

      const doc = docResponse.data;
      if (!doc) {
        throw new Error(`Unable to fetch Google Doc with ID: ${documentId}`);
      }

      const targetIndex = calculateAppendIndex(doc);
      logger.debug(`Calculated append index for document [${documentId}]: ${targetIndex}`);

      // Step 2: Issue batchUpdate to insert text at the end of document
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: targetIndex,
                },
                text: content,
              },
            },
          ],
        },
      });

      logger.info(`Successfully appended content to Google Doc [${documentId}]`);

      return {
        success: true,
        message: 'Content appended to the Google Doc successfully.',
        documentId,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Docs API append error for [${documentId}]:`, errorMsg);

      const gError = err as { code?: number; response?: { status?: number } };
      const status = gError.code || gError.response?.status;

      if (status === 404) {
        throw new Error(
          `Google Doc with ID "${documentId}" was not found. Please verify the document ID exists and is accessible.`
        );
      }
      if (status === 403) {
        throw new Error(
          `Access denied for Google Doc "${documentId}". Ensure that the authenticated Google account has edit permissions for this document and that https://www.googleapis.com/auth/documents is authorized.`
        );
      }
      if (status === 401) {
        throw new Error(
          'Google Docs authentication failed or token expired. Please run "npm run auth" to re-authenticate.'
        );
      }

      throw new Error(`Failed to append content to Google Doc "${documentId}": ${errorMsg}`);
    }
  }
}

export const docsService = new DocsService();
