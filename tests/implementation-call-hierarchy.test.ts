import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DidOpenTextDocumentNotification,
} from 'vscode-languageserver-protocol';
import { LspClient } from '../src/lsp-client.js';
import { pathToUri } from '../src/utils.js';
import { readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.resolve(
  __dirname,
  'fixtures/sample-project',
);

describe('Implementation and Call Hierarchy', () => {
  let client: LspClient;

  beforeAll(async () => {
    client = new LspClient(fixtureRoot);
    await client.start();

    const files = [
      'src/utils.ts',
      'src/index.ts',
      'src/interfaces.ts',
      'src/services.ts',
    ];

    const conn = client.getConnection();

    for (const file of files) {
      const filePath = path.join(fixtureRoot, file);
      const content = readFileSync(filePath, 'utf-8');
      conn.sendNotification(DidOpenTextDocumentNotification.type, {
        textDocument: {
          uri: pathToUri(filePath),
          languageId: 'typescript',
          version: 1,
          text: content,
        },
      });
    }

    // Give the language server time to process files
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 30000);

  afterAll(async () => {
    await client.shutdown();
  }, 10000);

  describe('goToImplementation', () => {
    it('should find implementations of an interface', async () => {
      const interfacesUri = pathToUri(path.join(fixtureRoot, 'src/interfaces.ts'));
      // "Greeter" interface at line 0, char 17 (0-indexed)
      const result = await client.implementation(interfacesUri, 0, 17);
      expect(result).not.toBeNull();
      const results = Array.isArray(result) ? result : [result];
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should return results for a concrete class method', async () => {
      const servicesUri = pathToUri(path.join(fixtureRoot, 'src/services.ts'));
      // "greet" method in FriendlyGreeter at line 3, char 2 (0-indexed)
      const result = await client.implementation(servicesUri, 3, 2);
      expect(result).not.toBeNull();
    });
  });

  describe('prepareCallHierarchy', () => {
    it('should return call hierarchy items for a function', async () => {
      const utilsUri = pathToUri(path.join(fixtureRoot, 'src/utils.ts'));
      // "greet" function at line 0, char 16 (0-indexed)
      const items = await client.prepareCallHierarchy(utilsUri, 0, 16);
      expect(items).not.toBeNull();
      expect(items!.length).toBeGreaterThanOrEqual(1);
      expect(items![0].name).toBe('greet');
    });
  });

  describe('callHierarchyIncomingCalls', () => {
    it('should find callers of a function', async () => {
      const utilsUri = pathToUri(path.join(fixtureRoot, 'src/utils.ts'));
      // "greet" function at line 0, char 16 (0-indexed)
      const items = await client.prepareCallHierarchy(utilsUri, 0, 16);
      expect(items).not.toBeNull();
      expect(items!.length).toBeGreaterThanOrEqual(1);

      const incoming = await client.callHierarchyIncomingCalls(items![0]);
      expect(incoming).not.toBeNull();
      // index.ts calls greet()
      expect(incoming!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('callHierarchyOutgoingCalls', () => {
    it('should find callees from a function scope', async () => {
      const utilsUri = pathToUri(path.join(fixtureRoot, 'src/utils.ts'));
      const items = await client.prepareCallHierarchy(utilsUri, 0, 16);
      expect(items).not.toBeNull();

      const outgoing = await client.callHierarchyOutgoingCalls(items![0]);
      expect(outgoing).not.toBeNull();
      // greet() is a simple function that doesn't call other functions
      expect(Array.isArray(outgoing)).toBe(true);
    });
  });
});
