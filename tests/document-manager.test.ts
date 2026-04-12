import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DocumentManager } from '../src/document-manager.js';
import { pathToUri } from '../src/utils.js';
import type { ProtocolConnection } from 'vscode-languageserver-protocol/node.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.resolve(
  __dirname,
  'fixtures/sample-project',
);
const utilsPath = path.join(fixtureRoot, 'src/utils.ts');
const utilsUri = pathToUri(utilsPath);

function createMockConnection(): ProtocolConnection {
  return {
    sendNotification: vi.fn(),
    sendRequest: vi.fn(),
    onNotification: vi.fn(),
    onRequest: vi.fn(),
    listen: vi.fn(),
    dispose: vi.fn(),
  } as unknown as ProtocolConnection;
}

describe('DocumentManager', () => {
  let docManager: DocumentManager;
  let mockConn: ProtocolConnection;

  beforeEach(() => {
    docManager = new DocumentManager();
    mockConn = createMockConnection();
  });

  describe('ensureOpen', () => {
    it('opens a document from disk', async () => {
      await docManager.ensureOpen(utilsUri, mockConn);

      expect(mockConn.sendNotification).toHaveBeenCalledTimes(1);
      expect(docManager.isOpen(utilsUri)).toBe(true);

      const content = docManager.getContent(utilsUri);
      expect(content).toContain('export function greet');
    });

    it('opens a document with provided content', async () => {
      const content = 'const x = 1;';
      await docManager.ensureOpen(utilsUri, mockConn, content);

      expect(docManager.isOpen(utilsUri)).toBe(true);
      expect(docManager.getContent(utilsUri)).toBe(content);
    });

    it('sends didChange when content differs', async () => {
      await docManager.ensureOpen(utilsUri, mockConn, 'initial content');
      expect(mockConn.sendNotification).toHaveBeenCalledTimes(1);
      expect(docManager.getVersion(utilsUri)).toBe(1);

      await docManager.ensureOpen(utilsUri, mockConn, 'updated content');
      expect(mockConn.sendNotification).toHaveBeenCalledTimes(2);
      expect(docManager.getVersion(utilsUri)).toBe(2);
      expect(docManager.getContent(utilsUri)).toBe('updated content');
    });

    it('does not send didChange when content is the same', async () => {
      const content = 'const x = 1;';
      await docManager.ensureOpen(utilsUri, mockConn, content);
      expect(mockConn.sendNotification).toHaveBeenCalledTimes(1);

      await docManager.ensureOpen(utilsUri, mockConn, content);
      // Should NOT have sent a second notification
      expect(mockConn.sendNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('getContent', () => {
    it('returns null for unopened document', () => {
      expect(docManager.getContent(utilsUri)).toBeNull();
    });

    it('returns content for opened document', async () => {
      await docManager.ensureOpen(utilsUri, mockConn, 'hello');
      expect(docManager.getContent(utilsUri)).toBe('hello');
    });
  });

  describe('isOpen', () => {
    it('returns false for unopened document', () => {
      expect(docManager.isOpen(utilsUri)).toBe(false);
    });

    it('returns true for opened document', async () => {
      await docManager.ensureOpen(utilsUri, mockConn, 'content');
      expect(docManager.isOpen(utilsUri)).toBe(true);
    });
  });

  describe('version tracking', () => {
    it('starts at version 1', async () => {
      await docManager.ensureOpen(utilsUri, mockConn, 'v1');
      expect(docManager.getVersion(utilsUri)).toBe(1);
    });

    it('increments on each change', async () => {
      await docManager.ensureOpen(utilsUri, mockConn, 'v1');
      await docManager.ensureOpen(utilsUri, mockConn, 'v2');
      await docManager.ensureOpen(utilsUri, mockConn, 'v3');
      expect(docManager.getVersion(utilsUri)).toBe(3);
    });
  });
});
