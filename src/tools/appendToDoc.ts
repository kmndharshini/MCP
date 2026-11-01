import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { docsService, AppendToDocParams, AppendToDocResult } from '../services/docsService.js';
import { logger } from '../utils/logger.js';

export const AppendToDocInputSchema = z.object({
  documentId: z
    .string({ required_error: 'Field "documentId" is required.' })
    .trim()
    .min(1, 'Field "documentId" cannot be empty.'),
  content: z
    .string({ required_error: 'Field "content" is required.' })
    .min(1, 'Field "content" cannot be empty.'),
});

export type AppendToDocInput = z.infer<typeof AppendToDocInputSchema>;

export const appendToDocToolDefinition = {
  name: 'append_to_google_doc',
  description:
    'Append plain text to the end of an existing Google Doc without modifying or deleting existing content.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      documentId: {
        type: 'string',
        description: 'The unique ID of the Google Doc to update (from the document URL: https://docs.google.com/document/d/<documentId>/edit).',
      },
      content: {
        type: 'string',
        description: 'Plain-text content to append to the end of the document.',
      },
    },
    required: ['documentId', 'content'],
  },
};

/**
 * Executes the append_to_google_doc tool logic with input validation and error formatting.
 */
export async function executeAppendToDoc(
  args: unknown,
  service = docsService
): Promise<CallToolResult> {
  // Step 1: Validate input arguments
  const parsed = AppendToDocInputSchema.safeParse(args);
  if (!parsed.success) {
    const errorDetails = parsed.error.errors.map((e) => `${e.path.join('.') || 'root'}: ${e.message}`).join('; ');
    logger.warn(`Validation failed for append_to_google_doc: ${errorDetails}`);
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Input validation error: ${errorDetails}`,
        },
      ],
    };
  }

  const { documentId, content } = parsed.data;

  // Step 2: Invoke Docs service
  try {
    const result: AppendToDocResult = await service.appendToDocument({
      documentId,
      content,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Error executing append_to_google_doc for [${documentId}]: ${message}`);
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Failed to append to Google Doc: ${message}`,
        },
      ],
    };
  }
}
