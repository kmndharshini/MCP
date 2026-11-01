import test from 'node:test';
import assert from 'node:assert';
import { GmailService, buildRfc2822Message, encodeMimeHeader } from '../src/services/gmailService.js';
import { executeSendEmail, SendEmailInputSchema } from '../src/tools/sendEmail.js';
import { createMockGmailClient } from './mocks/googleMocks.js';

test('Gmail Service - buildRfc2822Message formatting', () => {
  const rfc = buildRfc2822Message({
    to: 'alice@example.com',
    subject: 'Hello World',
    body: 'This is the message body.',
  });

  assert.ok(rfc.includes('From: me'));
  assert.ok(rfc.includes('To: alice@example.com'));
  assert.ok(rfc.includes('Subject: Hello World'));
  assert.ok(rfc.includes('Content-Type: text/plain; charset=utf-8'));
  assert.ok(rfc.includes('This is the message body.'));
  assert.ok(!rfc.includes('Cc:'));
});

test('Gmail Service - buildRfc2822Message with CC', () => {
  const rfc = buildRfc2822Message({
    to: 'alice@example.com',
    cc: 'bob@example.com',
    subject: 'Important Update',
    body: 'Body text.',
  });

  assert.ok(rfc.includes('Cc: bob@example.com'));
});

test('Gmail Service - non-ASCII subject encoding (RFC 2047)', () => {
  const encoded = encodeMimeHeader('Meeting with João 🚀');
  assert.ok(encoded.startsWith('=?UTF-8?B?'));
  assert.ok(encoded.endsWith('?='));

  const plain = encodeMimeHeader('Standard ASCII Subject');
  assert.strictEqual(plain, 'Standard ASCII Subject');
});

test('Gmail Service - sendEmail success returns messageId', async () => {
  const mock = createMockGmailClient({ messageId: 'msg-999-success' });
  const service = new GmailService(undefined, mock.gmail);

  const result = await service.sendEmail({
    to: 'test@example.com',
    subject: 'Test Subject',
    body: 'Test Body',
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.messageId, 'msg-999-success');
  assert.strictEqual(result.message, 'Email sent successfully.');
  assert.ok(mock.lastRawMessage?.includes('To: test@example.com'));
});

test('Gmail Service - handles 401 unauthenticated error', async () => {
  const mock = createMockGmailClient({ errorCode: 401 });
  const service = new GmailService(undefined, mock.gmail);

  await assert.rejects(
    async () => {
      await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        body: 'Body',
      });
    },
    /Gmail authentication failed or token expired/
  );
});

test('Gmail Service - handles 403 insufficient permission error', async () => {
  const mock = createMockGmailClient({ errorCode: 403 });
  const service = new GmailService(undefined, mock.gmail);

  await assert.rejects(
    async () => {
      await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        body: 'Body',
      });
    },
    /Insufficient permissions to send email/
  );
});

test('executeSendEmail Tool - schema validation passes with valid input', async () => {
  const mock = createMockGmailClient({ messageId: 'tool-msg-1' });
  const service = new GmailService(undefined, mock.gmail);

  const result = await executeSendEmail(
    {
      to: 'recipient@example.com',
      subject: 'MCP Server Test',
      body: 'Hello from MCP tool!',
    },
    service
  );

  assert.strictEqual(result.isError, undefined);
  assert.strictEqual(result.content.length, 1);
  const parsed = JSON.parse(result.content[0].text);
  assert.strictEqual(parsed.success, true);
  assert.strictEqual(parsed.messageId, 'tool-msg-1');
});

test('executeSendEmail Tool - schema validation rejects missing to', async () => {
  const result = await executeSendEmail({
    subject: 'Missing to',
    body: 'Some body',
  });

  assert.strictEqual(result.isError, true);
  assert.ok(result.content[0].text.includes('Field "to" is required'));
});

test('executeSendEmail Tool - schema validation rejects invalid email', async () => {
  const result = await executeSendEmail({
    to: 'invalid-email-address',
    subject: 'Bad Email',
    body: 'Some body',
  });

  assert.strictEqual(result.isError, true);
  assert.ok(result.content[0].text.includes('valid email address'));
});

test('executeSendEmail Tool - schema validation rejects empty subject', async () => {
  const result = await executeSendEmail({
    to: 'recipient@example.com',
    subject: '   ',
    body: 'Some body',
  });

  assert.strictEqual(result.isError, true);
  assert.ok(result.content[0].text.includes('cannot be empty'));
});

test('executeSendEmail Tool - schema validation rejects empty body', async () => {
  const result = await executeSendEmail({
    to: 'recipient@example.com',
    subject: 'Valid Subject',
    body: '',
  });

  assert.strictEqual(result.isError, true);
  assert.ok(result.content[0].text.includes('cannot be empty'));
});
