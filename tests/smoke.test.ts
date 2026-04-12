import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const fixtureRoot = path.resolve(__dirname, 'fixtures', 'sample-project');

let client: Client;
let transport: StdioClientTransport;

describe('Smoke tests', () => {
  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: [path.resolve(projectRoot, 'dist', 'index.js')],
    });

    client = new Client({ name: 'smoke-test', version: '1.0.0' });
    await client.connect(transport);
  }, 30000);

  afterAll(async () => {
    try {
      await client.close();
    } catch {
      // ignore cleanup errors
    }
  });

  it('ts_definition resolves greet import to utils.ts', async () => {
    // Go-to-definition on the import specifier './utils.js' should resolve to utils.ts
    // The string './utils.js' starts at column 29 on line 1
    const indexFile = path.resolve(fixtureRoot, 'src', 'index.ts');
    const result = await client.callTool({
      name: 'ts_definition',
      arguments: { file_path: indexFile, line: 1, column: 30 },
    });

    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(parsed.definitions).toBeDefined();
    expect(parsed.definitions.length).toBeGreaterThanOrEqual(1);

    // At least one definition should point to utils.ts
    const hasUtilsDef = parsed.definitions.some(
      (def: { file_path: string }) => def.file_path.includes('utils.ts'),
    );
    expect(hasUtilsDef).toBe(true);
  }, 30000);

  it('ts_references finds references to greet function', async () => {
    const utilsFile = path.resolve(fixtureRoot, 'src', 'utils.ts');
    const result = await client.callTool({
      name: 'ts_references',
      arguments: { file_path: utilsFile, line: 1, column: 17 },
    });

    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(parsed.references).toBeDefined();
    expect(parsed.references.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('ts_hover returns hover info for greet function', async () => {
    const utilsFile = path.resolve(fixtureRoot, 'src', 'utils.ts');
    const result = await client.callTool({
      name: 'ts_hover',
      arguments: { file_path: utilsFile, line: 1, column: 17 },
    });

    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(parsed.hover).toBeDefined();
    expect(parsed.hover).not.toBeNull();
    expect(parsed.hover.contents).toBeDefined();
    expect(parsed.hover.contents.length).toBeGreaterThan(0);
  }, 30000);

  it('ts_symbols returns file-scope symbols from utils.ts', async () => {
    const utilsFile = path.resolve(fixtureRoot, 'src', 'utils.ts');
    const result = await client.callTool({
      name: 'ts_symbols',
      arguments: { query: '', file_path: utilsFile, scope: 'file' },
    });

    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(parsed.symbols).toBeDefined();
    expect(parsed.symbols.length).toBeGreaterThanOrEqual(2);

    const names = parsed.symbols.map((s: { name: string }) => s.name);
    expect(names).toContain('greet');
    expect(names).toContain('add');

    // Verify symbol structure
    const greetSym = parsed.symbols.find((s: { name: string }) => s.name === 'greet');
    expect(greetSym.kind).toBe('function');
    expect(greetSym.file_path).toContain('utils.ts');
    expect(greetSym.line).toBe(1);
    expect(typeof greetSym.column).toBe('number');
  }, 30000);

  it('ts_symbols filters file-scope symbols by query', async () => {
    const utilsFile = path.resolve(fixtureRoot, 'src', 'utils.ts');
    const result = await client.callTool({
      name: 'ts_symbols',
      arguments: { query: 'greet', file_path: utilsFile, scope: 'file' },
    });

    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(parsed.symbols).toBeDefined();
    expect(parsed.symbols.length).toBe(1);
    expect(parsed.symbols[0].name).toBe('greet');
  }, 30000);

  it('ts_symbols returns workspace-scope symbols', async () => {
    const utilsFile = path.resolve(fixtureRoot, 'src', 'utils.ts');
    const result = await client.callTool({
      name: 'ts_symbols',
      arguments: { query: 'greet', file_path: utilsFile, scope: 'workspace' },
    });

    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(parsed.symbols).toBeDefined();
    expect(parsed.symbols.length).toBeGreaterThanOrEqual(1);

    const greetSym = parsed.symbols.find((s: { name: string; file_path: string }) => s.name === 'greet' && s.file_path.includes('utils.ts'));
    expect(greetSym).toBeDefined();
    expect(greetSym.kind).toBe('function');
    expect(greetSym.line).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('ts_symbols defaults to workspace scope', async () => {
    const utilsFile = path.resolve(fixtureRoot, 'src', 'utils.ts');
    const result = await client.callTool({
      name: 'ts_symbols',
      arguments: { query: 'add', file_path: utilsFile },
    });

    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(parsed.symbols).toBeDefined();
    expect(parsed.symbols.length).toBeGreaterThanOrEqual(1);

    const addSym = parsed.symbols.find((s: { name: string }) => s.name === 'add');
    expect(addSym).toBeDefined();
  }, 30000);

  it('ts_symbols returns empty array for no matches', async () => {
    const utilsFile = path.resolve(fixtureRoot, 'src', 'utils.ts');
    const result = await client.callTool({
      name: 'ts_symbols',
      arguments: { query: 'nonexistentsymbolxyz', file_path: utilsFile, scope: 'file' },
    });

    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(parsed.symbols).toBeDefined();
    expect(parsed.symbols.length).toBe(0);
  }, 30000);

  it('ts_symbols uses absolute file paths and 1-indexed positions', async () => {
    const utilsFile = path.resolve(fixtureRoot, 'src', 'utils.ts');
    const result = await client.callTool({
      name: 'ts_symbols',
      arguments: { query: '', file_path: utilsFile, scope: 'file' },
    });

    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    for (const sym of parsed.symbols) {
      expect(path.isAbsolute(sym.file_path)).toBe(true);
      expect(sym.line).toBeGreaterThanOrEqual(1);
      expect(sym.column).toBeGreaterThanOrEqual(1);
    }
  }, 30000);
});
