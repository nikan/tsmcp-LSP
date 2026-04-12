import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { DidOpenTextDocumentNotification } from 'vscode-languageserver-protocol';
import { LspClient } from '../src/lsp-client.js';
import { pathToUri, uriToPath } from '../src/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.resolve(__dirname, 'fixtures/sample-project');

describe('Definition resolution through imports', () => {
  let client: LspClient;

  const utilsPath = path.join(fixtureRoot, 'src/utils.ts');
  const indexPath = path.join(fixtureRoot, 'src/index.ts');

  beforeAll(async () => {
    client = new LspClient(fixtureRoot);
    await client.start();

    const conn = client.getConnection();

    conn.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: pathToUri(utilsPath),
        languageId: 'typescript',
        version: 1,
        text: readFileSync(utilsPath, 'utf-8'),
      },
    });

    conn.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: pathToUri(indexPath),
        languageId: 'typescript',
        version: 1,
        text: readFileSync(indexPath, 'utf-8'),
      },
    });

    // Allow the language server to process
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 30000);

  afterAll(async () => {
    await client.shutdown();
  }, 10000);

  it('should resolve definition at import to the actual declaration in the target module', async () => {
    const indexUri = pathToUri(indexPath);
    // "greet" in `import { greet, add } from './utils.js'` — line 0, char 9 (0-indexed)
    const result = await client.definition(indexUri, 0, 9);

    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);

    const defs = result as Array<Record<string, unknown>>;
    expect(defs.length).toBeGreaterThanOrEqual(1);

    // With linkSupport: true, the server returns LocationLink[] (has targetUri)
    const first = defs[0];
    expect(first).toHaveProperty('targetUri');

    // The target must be utils.ts, not index.ts (import binding)
    const targetPath = uriToPath(first.targetUri as string);
    expect(path.resolve(targetPath)).toBe(path.resolve(utilsPath));
  });

  it('should resolve definition at usage site to the actual declaration', async () => {
    const indexUri = pathToUri(indexPath);
    // `greet('World')` at line 2, char 16 (0-indexed) — the "greet" identifier
    const result = await client.definition(indexUri, 2, 16);

    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);

    const defs = result as Array<Record<string, unknown>>;
    expect(defs.length).toBeGreaterThanOrEqual(1);

    const first = defs[0];
    expect(first).toHaveProperty('targetUri');

    const targetPath = uriToPath(first.targetUri as string);
    expect(path.resolve(targetPath)).toBe(path.resolve(utilsPath));
  });

  it('should resolve definition of second import to the correct declaration', async () => {
    const indexUri = pathToUri(indexPath);
    // "add" in `import { greet, add } from './utils.js'` — line 0, char 16 (0-indexed)
    const result = await client.definition(indexUri, 0, 16);

    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);

    const defs = result as Array<Record<string, unknown>>;
    expect(defs.length).toBeGreaterThanOrEqual(1);

    const first = defs[0];
    expect(first).toHaveProperty('targetUri');

    const targetPath = uriToPath(first.targetUri as string);
    expect(path.resolve(targetPath)).toBe(path.resolve(utilsPath));

    // Verify it points to the add function, not the greet function
    // add is on line 4 (0-indexed) in utils.ts: `export function add(...)`
    const targetRange = first.targetSelectionRange as { start: { line: number } };
    expect(targetRange.start.line).toBe(4);
  });
});
