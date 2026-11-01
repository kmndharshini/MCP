import test from 'node:test';
import assert from 'node:assert';
import { createServer } from '../src/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

test('MCP Protocol - Server registers tools and responds to tools/list', async () => {
  const server = createServer();

  // Retrieve the registered handler for ListToolsRequestSchema
  const listHandler = (server as unknown as {
    _requestHandlers: Map<string, (req: unknown) => Promise<{ tools: Array<{ name: string; description: string }> }>>;
  })._requestHandlers.get(ListToolsRequestSchema.shape.method.value);

  assert.ok(listHandler, 'tools/list handler should be registered');

  const result = await listHandler({ method: 'tools/list' });
  assert.ok(Array.isArray(result.tools));
  assert.strictEqual(result.tools.length, 2);

  const toolNames = result.tools.map((t) => t.name);
  assert.ok(toolNames.includes('send_email'));
  assert.ok(toolNames.includes('append_to_google_doc'));

  const sendEmailTool = result.tools.find((t) => t.name === 'send_email');
  assert.ok(sendEmailTool?.description.includes('Gmail'));

  const appendDocTool = result.tools.find((t) => t.name === 'append_to_google_doc');
  assert.ok(appendDocTool?.description.includes('Google Doc'));
});

test('MCP Protocol - tools/call throws MethodNotFound for unknown tool', async () => {
  const server = createServer();

  const callHandler = (server as unknown as {
    _requestHandlers: Map<string, (req: { params: { name: string; arguments?: unknown } }) => Promise<unknown>>;
  })._requestHandlers.get(CallToolRequestSchema.shape.method.value);

  assert.ok(callHandler, 'tools/call handler should be registered');

  await assert.rejects(
    async () => {
      await callHandler({
        method: 'tools/call',
        params: {
          name: 'unknown_nonexistent_tool',
          arguments: {},
        },
      });
    },
    (err: unknown) => {
      if (err instanceof McpError) {
        assert.strictEqual(err.code, ErrorCode.MethodNotFound);
        assert.ok(err.message.includes('unknown_nonexistent_tool'));
        return true;
      }
      return false;
    }
  );
});
