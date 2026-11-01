import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { sendEmailToolDefinition, executeSendEmail } from './tools/sendEmail.js';
import { appendToDocToolDefinition, executeAppendToDoc } from './tools/appendToDoc.js';
import { logger } from './utils/logger.js';

/**
 * Creates and configures the Google Workspace MCP Server instance.
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'google-workspace-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool discovery handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Received tools/list request');
    return {
      tools: [
        sendEmailToolDefinition,
        appendToDocToolDefinition,
      ],
    };
  });

  // Register tool invocation handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`Received tools/call request for tool: "${name}"`);

    switch (name) {
      case 'send_email':
        return await executeSendEmail(args);

      case 'append_to_google_doc':
        return await executeAppendToDoc(args);

      default:
        logger.error(`Unknown tool requested: "${name}"`);
        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: "${name}"`);
    }
  });

  return server;
}

/**
 * Main application bootstrap function.
 */
export async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Register cleanup handlers
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Gracefully stopping Google Workspace MCP Server...`);
    try {
      await server.close();
    } catch (err) {
      logger.error('Error during server shutdown:', err);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
  });

  // Connect transport and start listening
  await server.connect(transport);
  logger.info('Google Workspace MCP Server is running and listening on stdio transport.');
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Only start the server when executed directly as the entrypoint
function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  try {
    const currentFile = fileURLToPath(import.meta.url).toLowerCase();
    const entryFile = path.resolve(process.argv[1]).toLowerCase();
    return (
      entryFile === currentFile ||
      entryFile.replace(/\.ts$/, '.js') === currentFile ||
      currentFile.replace(/\.js$/, '.ts') === entryFile
    );
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  main().catch((err) => {
    logger.error('Fatal startup error:', err);
    process.exit(1);
  });
}
