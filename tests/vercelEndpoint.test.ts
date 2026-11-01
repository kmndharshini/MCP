import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import app from '../api/index.js';
import { config } from '../src/config/index.js';

test('Vercel API - GET / health endpoint returns healthy status and tools list', async () => {
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);

    const data = await res.json() as {
      status: string;
      server: string;
      tools: string[];
    };

    assert.strictEqual(data.status, 'healthy');
    assert.strictEqual(data.server, 'google-workspace-mcp');
    assert.ok(data.tools.includes('send_email'));
    assert.ok(data.tools.includes('append_to_google_doc'));
  } finally {
    server.close();
  }
});

test('Vercel API - authMiddleware rejects requests when MCP_API_SECRET is set', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const origSecret = config.mcpApiSecret;
  config.mcpApiSecret = 'super-secret-key-123';

  try {
    // 1. Unauthenticated request to /sse should return 401
    const unauthRes = await fetch(`${baseUrl}/sse`);
    assert.strictEqual(unauthRes.status, 401);
    const unauthBody = await unauthRes.json() as { error: string };
    assert.ok(unauthBody.error.includes('Unauthorized'));

    // 2. Authenticated with ?key= query parameter should be accepted
    const queryRes = await fetch(`${baseUrl}/message?key=super-secret-key-123`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    // It passes auth check and reaches session validation (400 since no session provided)
    assert.strictEqual(queryRes.status, 400);

    // 3. Authenticated with Authorization: Bearer header should be accepted
    const bearerRes = await fetch(`${baseUrl}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer super-secret-key-123',
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(bearerRes.status, 400);
  } finally {
    config.mcpApiSecret = origSecret;
    server.close();
  }
});
