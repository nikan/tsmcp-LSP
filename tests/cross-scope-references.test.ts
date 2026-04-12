import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LspClient } from '../src/lsp-client.js';
import { WorkspaceManager } from '../src/workspace-manager.js';
import { DocumentManager } from '../src/document-manager.js';
import { pathToUri, uriToPath } from '../src/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.resolve(__dirname, 'fixtures/sample-project');

describe('Cross-scope references (src + tests)', () => {
  let manager: WorkspaceManager;
  let documentManager: DocumentManager;
  let client: LspClient;

  const utilsPath = path.join(fixtureRoot, 'src/utils.ts');
  const indexPath = path.join(fixtureRoot, 'src/index.ts');
  const testFilePath = path.join(fixtureRoot, 'tests/utils.test.ts');

  beforeAll(async () => {
    documentManager = new DocumentManager();
    manager = new WorkspaceManager(documentManager);

    // getClient triggers broadenScope which opens all .ts files including tests/
    client = await manager.getClient(utilsPath);

    // Allow the language server to process all opened files
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }, 30000);

  afterAll(async () => {
    await manager.shutdownAll();
  }, 10000);

  it('ts_references on greet should find references in src/index.ts AND tests/utils.test.ts', async () => {
    const utilsUri = pathToUri(utilsPath);
    // "greet" declaration at line 0, char 16 (0-indexed): export function greet(...)
    const result = await client.references(utilsUri, 0, 16, true);

    expect(result).not.toBeNull();
    const refs = result!;
    const refPaths = refs.map((loc) => path.resolve(uriToPath(loc.uri)));
    const uniquePaths = [...new Set(refPaths)];

    expect(uniquePaths).toContain(path.resolve(utilsPath));
    expect(uniquePaths).toContain(path.resolve(indexPath));
    expect(uniquePaths).toContain(path.resolve(testFilePath));
  });

  it('ts_references on add should find references in src/index.ts AND tests/utils.test.ts', async () => {
    const utilsUri = pathToUri(utilsPath);
    // "add" declaration at line 4, char 16 (0-indexed): export function add(...)
    const result = await client.references(utilsUri, 4, 16, true);

    expect(result).not.toBeNull();
    const refs = result!;
    const refPaths = refs.map((loc) => path.resolve(uriToPath(loc.uri)));
    const uniquePaths = [...new Set(refPaths)];

    expect(uniquePaths).toContain(path.resolve(utilsPath));
    expect(uniquePaths).toContain(path.resolve(indexPath));
    expect(uniquePaths).toContain(path.resolve(testFilePath));
  });

  it('workspace symbols should find symbols from test files', async () => {
    // Search for "greeting" — a variable defined only in tests/utils.test.ts
    const result = await client.workspaceSymbol('greeting');

    expect(result).not.toBeNull();
    const symbols = result!;
    expect(symbols.length).toBeGreaterThanOrEqual(1);

    const symbolPaths = symbols.map((sym) => {
      const loc = sym.location;
      const uri = 'uri' in loc ? loc.uri : '';
      return path.resolve(uriToPath(uri));
    });

    expect(symbolPaths).toContain(path.resolve(testFilePath));
  });

  it('document symbols on a test file should return its symbols', async () => {
    const testUri = pathToUri(testFilePath);
    const result = await client.documentSymbol(testUri);

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(1);

    // Should find at least the "greeting" and "sum" variables
    const names = result!.map((sym) => sym.name);
    expect(names).toContain('greeting');
    expect(names).toContain('sum');
  });

  it('references within source files only should still work (no regression)', async () => {
    const indexUri = pathToUri(indexPath);
    // "message" variable in index.ts, line 2, char 6 (0-indexed): const message = ...
    const result = await client.references(indexUri, 2, 6, true);

    expect(result).not.toBeNull();
    const refs = result!;
    // "message" is only used in index.ts (declaration + console.log)
    const refPaths = refs.map((loc) => path.resolve(uriToPath(loc.uri)));
    const uniquePaths = [...new Set(refPaths)];
    expect(uniquePaths).toEqual([path.resolve(indexPath)]);
  });
});
