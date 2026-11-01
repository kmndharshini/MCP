import test from 'node:test';
import assert from 'node:assert';
import { DocsService, calculateAppendIndex } from '../src/services/docsService.js';
import { executeAppendToDoc, AppendToDocInputSchema } from '../src/tools/appendToDoc.js';
import { createMockDocsClient } from './mocks/googleMocks.js';

test('Docs Service - calculateAppendIndex with existing content', () => {
  const mockDoc = {
    documentId: 'doc-123',
    body: {
      content: [
        {
          startIndex: 1,
          endIndex: 250,
        },
      ],
    },
  };

  // Google Docs API ends with segment delimiter; valid insertion point is endIndex - 1
  const index = calculateAppendIndex(mockDoc);
  assert.strictEqual(index, 249);
});

test('Docs Service - calculateAppendIndex with empty document', () => {
  const mockDoc = {
    documentId: 'doc-empty',
    body: {
      content: [
        {
          startIndex: 1,
          endIndex: 2,
        },
      ],
    },
  };

  const index = calculateAppendIndex(mockDoc);
  assert.strictEqual(index, 1);
});

test('Docs Service - calculateAppendIndex fallback when content is empty', () => {
  const mockDoc = {
    documentId: 'doc-none',
    body: {
      content: [],
    },
  };

  const index = calculateAppendIndex(mockDoc);
  assert.strictEqual(index, 1);
});

test('Docs Service - appendToDocument success inserts text at calculated index', async () => {
  const mock = createMockDocsClient({ initialEndIndex: 120 });
  const service = new DocsService(undefined, mock.docs);

  const result = await service.appendToDocument({
    documentId: 'my-test-doc-id',
    content: '\nAppended notes from MCP server',
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.documentId, 'my-test-doc-id');
  assert.strictEqual(result.message, 'Content appended to the Google Doc successfully.');

  // Target index should be 120 - 1 = 119
  assert.strictEqual(mock.lastTargetIndex, 119);
  assert.strictEqual(mock.lastInsertedText, '\nAppended notes from MCP server');
});

test('Docs Service - handles 404 document not found', async () => {
  const mock = createMockDocsClient({ getErrorCode: 404 });
  const service = new DocsService(undefined, mock.docs);

  await assert.rejects(
    async () => {
      await service.appendToDocument({
        documentId: 'non-existent-doc-id',
        content: 'Hello',
      });
    },
    /Google Doc with ID "non-existent-doc-id" was not found/
  );
});

test('Docs Service - handles 403 permission denied', async () => {
  const mock = createMockDocsClient({ updateErrorCode: 403 });
  const service = new DocsService(undefined, mock.docs);

  await assert.rejects(
    async () => {
      await service.appendToDocument({
        documentId: 'forbidden-doc-id',
        content: 'Hello',
      });
    },
    /Access denied for Google Doc "forbidden-doc-id"/
  );
});

test('executeAppendToDoc Tool - schema validation passes with valid input', async () => {
  const mock = createMockDocsClient({ initialEndIndex: 50 });
  const service = new DocsService(undefined, mock.docs);

  const result = await executeAppendToDoc(
    {
      documentId: 'valid-doc-id',
      content: 'Important meeting notes',
    },
    service
  );

  assert.strictEqual(result.isError, undefined);
  assert.strictEqual(result.content.length, 1);
  const parsed = JSON.parse(result.content[0].text);
  assert.strictEqual(parsed.success, true);
  assert.strictEqual(parsed.documentId, 'valid-doc-id');
});

test('executeAppendToDoc Tool - schema validation rejects missing documentId', async () => {
  const result = await executeAppendToDoc({
    content: 'Content without ID',
  });

  assert.strictEqual(result.isError, true);
  assert.ok(result.content[0].text.includes('Field "documentId" is required'));
});

test('executeAppendToDoc Tool - schema validation rejects empty documentId', async () => {
  const result = await executeAppendToDoc({
    documentId: '   ',
    content: 'Content',
  });

  assert.strictEqual(result.isError, true);
  assert.ok(result.content[0].text.includes('cannot be empty'));
});

test('executeAppendToDoc Tool - schema validation rejects missing content', async () => {
  const result = await executeAppendToDoc({
    documentId: 'some-doc-id',
  });

  assert.strictEqual(result.isError, true);
  assert.ok(result.content[0].text.includes('Field "content" is required'));
});

test('executeAppendToDoc Tool - schema validation rejects empty content', async () => {
  const result = await executeAppendToDoc({
    documentId: 'some-doc-id',
    content: '',
  });

  assert.strictEqual(result.isError, true);
  assert.ok(result.content[0].text.includes('cannot be empty'));
});
