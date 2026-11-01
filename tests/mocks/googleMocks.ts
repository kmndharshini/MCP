import { gmail_v1, docs_v1 } from 'googleapis';

/**
 * Creates a mock Gmail API client for unit testing.
 */
export function createMockGmailClient(options: {
  sendSuccess?: boolean;
  messageId?: string;
  errorCode?: number;
  errorMessage?: string;
} = {}): {
  gmail: gmail_v1.Gmail;
  lastRawMessage: string | null;
  lastSendPayload: unknown;
} {
  let lastRawMessage: string | null = null;
  let lastSendPayload: unknown = null;

  const mockGmail = {
    users: {
      messages: {
        send: async (params: { userId: string; requestBody?: { raw?: string } }) => {
          lastSendPayload = params;
          if (params.requestBody?.raw) {
            // Decode base64url back to plain text for assertions
            const base64 = params.requestBody.raw
              .replace(/-/g, '+')
              .replace(/_/g, '/');
            lastRawMessage = Buffer.from(base64, 'base64').toString('utf-8');
          }

          if (options.errorCode) {
            const err: Record<string, unknown> = new Error(options.errorMessage || 'Mock Gmail API error');
            err.code = options.errorCode;
            throw err;
          }

          if (options.sendSuccess === false) {
            throw new Error(options.errorMessage || 'Failed to send message');
          }

          return {
            data: {
              id: options.messageId || 'mock-message-id-12345',
              threadId: 'mock-thread-id-67890',
            },
          };
        },
      },
    },
  } as unknown as gmail_v1.Gmail;

  return {
    gmail: mockGmail,
    get lastRawMessage() {
      return lastRawMessage;
    },
    get lastSendPayload() {
      return lastSendPayload;
    },
  };
}

/**
 * Creates a mock Google Docs API client for unit testing.
 */
export function createMockDocsClient(options: {
  initialEndIndex?: number;
  getErrorCode?: number;
  updateErrorCode?: number;
  errorMessage?: string;
} = {}): {
  docs: docs_v1.Docs;
  lastBatchUpdateRequest: unknown;
  lastTargetIndex: number | null;
  lastInsertedText: string | null;
} {
  let lastBatchUpdateRequest: unknown = null;
  let lastTargetIndex: number | null = null;
  let lastInsertedText: string | null = null;

  const mockDocs = {
    documents: {
      get: async (params: { documentId: string }) => {
        if (options.getErrorCode) {
          const err: Record<string, unknown> = new Error(options.errorMessage || 'Mock Docs GET error');
          err.code = options.getErrorCode;
          throw err;
        }

        const endIndex = options.initialEndIndex ?? 100;
        return {
          data: {
            documentId: params.documentId,
            title: 'Mock Document',
            body: {
              content: [
                {
                  startIndex: 1,
                  endIndex: endIndex,
                  paragraph: {
                    elements: [
                      {
                        startIndex: 1,
                        endIndex: endIndex,
                        textRun: {
                          content: 'Existing mock text in the doc\n',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        };
      },
      batchUpdate: async (params: { documentId: string; requestBody?: { requests?: Array<{ insertText?: { location?: { index?: number }; text?: string } }> } }) => {
        lastBatchUpdateRequest = params;
        if (options.updateErrorCode) {
          const err: Record<string, unknown> = new Error(options.errorMessage || 'Mock Docs UPDATE error');
          err.code = options.updateErrorCode;
          throw err;
        }

        const insertReq = params.requestBody?.requests?.[0]?.insertText;
        if (insertReq) {
          lastTargetIndex = insertReq.location?.index ?? null;
          lastInsertedText = insertReq.text ?? null;
        }

        return {
          data: {
            documentId: params.documentId,
            replies: [{}],
          },
        };
      },
    },
  } as unknown as docs_v1.Docs;

  return {
    docs: mockDocs,
    get lastBatchUpdateRequest() {
      return lastBatchUpdateRequest;
    },
    get lastTargetIndex() {
      return lastTargetIndex;
    },
    get lastInsertedText() {
      return lastInsertedText;
    },
  };
}
