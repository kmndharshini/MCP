import express, { Request, Response, NextFunction } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { sendEmailToolDefinition, executeSendEmail } from '../src/tools/sendEmail.js';
import { appendToDocToolDefinition, executeAppendToDoc } from '../src/tools/appendToDoc.js';
import { config } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';

const app = express();

// Parse JSON request bodies for POST endpoints
app.use(express.json());

// Enable CORS for web/client integrations
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

/**
 * Security Middleware:
 * If MCP_API_SECRET is configured, require authorization via either:
 * 1. Authorization: Bearer <MCP_API_SECRET> header
 * 2. ?key=<MCP_API_SECRET> or ?apiKey=<MCP_API_SECRET> query parameter
 */
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = config.mcpApiSecret;
  if (!secret || secret.trim().length === 0) {
    // No secret configured, allow access
    return next();
  }

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const queryToken = (req.query.key as string) || (req.query.apiKey as string);

  const clientToken = bearerToken || queryToken;

  if (clientToken !== secret) {
    logger.warn('Unauthorized access attempt to MCP Vercel endpoint.');
    res.status(401).json({
      error: 'Unauthorized: Invalid or missing API key. Provide "Authorization: Bearer <key>" header or "?key=<key>" query param.',
    });
    return;
  }

  next();
}

/**
 * Health check endpoint for verifying deployment status
 */
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    server: 'google-workspace-mcp',
    version: '1.0.0',
    transport: 'sse',
    endpoints: {
      sse: '/sse',
      message: '/message',
    },
    tools: [
      'send_email',
      'append_to_google_doc',
    ],
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Store active SSE transports by sessionId
const activeTransports = new Map<string, SSEServerTransport>();

/**
 * Factory to create and configure a new MCP Server instance
 */
function createMcpServerInstance(): Server {
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

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        sendEmailToolDefinition,
        appendToDocToolDefinition,
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`Vercel MCP Server: Executing tool "${name}"`);

    switch (name) {
      case 'send_email':
        return await executeSendEmail(args);
      case 'append_to_google_doc':
        return await executeAppendToDoc(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: "${name}"`);
    }
  });

  return server;
}

/**
 * GET /sse: Establish Server-Sent Events stream
 */
app.get('/sse', authMiddleware, async (req: Request, res: Response) => {
  logger.info('Incoming SSE connection request');

  const server = createMcpServerInstance();
  const transport = new SSEServerTransport('/message', res);

  activeTransports.set(transport.sessionId, transport);

  transport.onclose = () => {
    logger.info(`SSE connection closed for session: ${transport.sessionId}`);
    activeTransports.delete(transport.sessionId);
  };

  transport.onerror = (err) => {
    logger.error(`SSE transport error for session ${transport.sessionId}:`, err);
  };

  await server.connect(transport);
});

/**
 * POST /message: Accept client JSON-RPC invocations
 */
app.post('/message', authMiddleware, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;

  let transport: SSEServerTransport | undefined;

  if (sessionId) {
    transport = activeTransports.get(sessionId);
  }

  // Fallback if there is a single active transport
  if (!transport && activeTransports.size === 1) {
    transport = Array.from(activeTransports.values())[0];
  }

  if (!transport) {
    logger.warn(`No active SSE session found for sessionId: "${sessionId}"`);
    return res.status(400).json({
      error: `No active SSE session found. Session may have expired or sessionId is invalid: ${sessionId || 'none'}`,
    });
  }

  await transport.handlePostMessage(req, res);
});

export default app;
