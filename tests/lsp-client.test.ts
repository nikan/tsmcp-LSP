import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import {
  DidOpenTextDocumentNotification,
  TextDocumentSyncKind,
} from 'vscode-languageserver-protocol';
import { LspClient } from '../src/lsp-client.js';
import { pathToUri } from '../src/utils.js';
import { readFileSync } from 'node:fs';

const fixtureRoot = path.resolve(
  import.meta.dirname,
  'fixtures/sample-project',
);

describe('LspClient', () => {
  let client: LspClient;

  beforeAll(async () => {
    client = new LspClient(fixtureRoot);
    await client.start();

    // Open the fixture files so the language server knows about them
    const utilsPath = path.join(fixtureRoot, 'src/utils.ts');
    const indexPath = path.join(fixtureRoot, 'src/index.ts');

    const utilsContent = readFileSync(utilsPath, 'utf-8');
    const indexContent = readFileSync(indexPath, 'utf-8');

    const conn = client.getConnection();

    conn.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: pathToUri(utilsPath),
        languageId: 'typescript',
        version: 1,
        text: utilsContent,
      },
    });

    conn.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: pathToUri(indexPath),
        languageId: 'typescript',
        version: 1,
        text: indexContent,
      },
    });

    // Give the language server a moment to process the files
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 30000);

  afterAll(async () => {
    await client.shutdown();
  }, 10000);

  it('should be initialized after start', () => {
    expect(client.isInitialized).toBe(true);
  });

  it('should get hover information', async () => {
    const utilsUri = pathToUri(path.join(fixtureRoot, 'src/utils.ts'));
    // Hover over "greet" function name at line 0, char 16 (0-indexed)
    const hover = await client.hover(utilsUri, 0, 16);
    expect(hover).not.toBeNull();
    expect(hover!.contents).toBeDefined();
  });

  it('should get definition', async () => {
    const indexUri = pathToUri(path.join(fixtureRoot, 'src/index.ts'));
    // "greet" is imported at line 0, around character 9 (0-indexed)
    const def = await client.definition(indexUri, 0, 9);
    expect(def).not.toBeNull();
  });

  it('should get references', async () => {
    const utilsUri = pathToUri(path.join(fixtureRoot, 'src/utils.ts'));
    // "greet" function declaration at line 0, char 16 (0-indexed)
    const refs = await client.references(utilsUri, 0, 16);
    expect(refs).not.toBeNull();
    expect(Array.isArray(refs)).toBe(true);
    expect(refs!.length).toBeGreaterThanOrEqual(1);
  });

  it('should get document symbols', async () => {
    const utilsUri = pathToUri(path.join(fixtureRoot, 'src/utils.ts'));
    const symbols = await client.documentSymbol(utilsUri);
    expect(symbols).not.toBeNull();
    expect(Array.isArray(symbols)).toBe(true);
    expect(symbols!.length).toBeGreaterThanOrEqual(1);
  });

  it('should get workspace symbols', async () => {
    const symbols = await client.workspaceSymbol('greet');
    expect(symbols).not.toBeNull();
    expect(Array.isArray(symbols)).toBe(true);
  });

  it('should handle clean shutdown', async () => {
    // Create a new client for shutdown test
    const tempClient = new LspClient(fixtureRoot);
    await tempClient.start();
    expect(tempClient.isInitialized).toBe(true);
    await tempClient.shutdown();
    expect(tempClient.isInitialized).toBe(false);
  }, 15000);
});
