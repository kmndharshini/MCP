import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { gmailService, SendEmailParams, SendEmailResult } from '../services/gmailService.js';
import { logger } from '../utils/logger.js';

/**
 * Validates one or more comma-separated email addresses.
 */
function isValidEmailList(val: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const addresses = val.split(',').map((a) => a.trim()).filter((a) => a.length > 0);
  if (addresses.length === 0) return false;
  return addresses.every((addr) => emailRegex.test(addr));
}

export const SendEmailInputSchema = z.object({
  to: z
    .string({ required_error: 'Field "to" is required.' })
    .trim()
    .min(1, 'Recipient email address ("to") cannot be empty.')
    .refine(isValidEmailList, {
      message: 'Recipient email address ("to") must be a valid email address.',
    }),
  subject: z
    .string({ required_error: 'Field "subject" is required.' })
    .trim()
    .min(1, 'Email "subject" cannot be empty.'),
  body: z
    .string({ required_error: 'Field "body" is required.' })
    .min(1, 'Email "body" cannot be empty.'),
  cc: z
    .string()
    .optional()
    .refine((val) => val === undefined || val.trim() === '' || isValidEmailList(val), {
      message: 'CC recipient(s) must be valid comma-separated email address(es).',
    }),
});

export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;

export const sendEmailToolDefinition = {
  name: 'send_email',
  description:
    'Send an email from the authenticated user\'s Gmail account using the Gmail API.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      to: {
        type: 'string',
        description: 'Recipient email address (e.g. recipient@example.com). Multiple addresses may be comma-separated.',
      },
      subject: {
        type: 'string',
        description: 'Subject of the email (must not be empty).',
      },
      body: {
        type: 'string',
        description: 'Plain-text body content of the email.',
      },
      cc: {
        type: 'string',
        description: 'Optional CC recipient email address(es), comma-separated if multiple.',
      },
    },
    required: ['to', 'subject', 'body'],
  },
};

/**
 * Executes the send_email tool logic with input validation and error formatting.
 */
export async function executeSendEmail(
  args: unknown,
  service = gmailService
): Promise<CallToolResult> {
  // Step 1: Validate input arguments
  const parsed = SendEmailInputSchema.safeParse(args);
  if (!parsed.success) {
    const errorDetails = parsed.error.errors.map((e) => `${e.path.join('.') || 'root'}: ${e.message}`).join('; ');
    logger.warn(`Validation failed for send_email: ${errorDetails}`);
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

  const { to, subject, body, cc } = parsed.data;

  // Step 2: Invoke Gmail service
  try {
    const result: SendEmailResult = await service.sendEmail({
      to,
      subject,
      body,
      cc: cc && cc.trim().length > 0 ? cc.trim() : undefined,
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
    logger.error(`Error executing send_email: ${message}`);
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Failed to send email: ${message}`,
        },
      ],
    };
  }
}
