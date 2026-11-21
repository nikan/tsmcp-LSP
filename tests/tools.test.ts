// In-process tests of the six MCP tool handlers: same server wiring as src/index.ts, but over an in-memory
// transport so the handlers run (and are measured) in the test process. The smoke test covers the stdio binary.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { WorkspaceManager } from '../src/workspace-manager.js';
import { DocumentManager } from '../src/document-manager.js';
import { registerDefinitionTool } from '../src/tools/definition.js';
import { registerReferencesTool } from '../src/tools/references.js';
import { registerHoverTool } from '../src/tools/hover.js';
import { registerSymbolsTool } from '../src/tools/symbols.js';
import { registerImplementationTool } from '../src/tools/implementation.js';
import { registerCallHierarchyTool } from '../src/tools/call-hierarchy.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.resolve(currentDir, 'fixtures/sample-project');
const utilsPath = path.join(fixtureRoot, 'src/utils.ts');
const indexPath = path.join(fixtureRoot, 'src/index.ts');
const interfacesPath = path.join(fixtureRoot, 'src/interfaces.ts');
const servicesPath = path.join(fixtureRoot, 'src/services.ts');

interface Entry {
  file_path: string;
  line: number;
  column: number;
  preview?: string | null;
}

describe('MCP tool handlers (in-process)', () => {
  let workspaceManager: WorkspaceManager;
  let client: Client;

  async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text: string }>;
    return JSON.parse(content[0].text) as T;
  }

  beforeAll(async () => {
    const server = new McpServer({ name: 'tsmcp-lsp-test', version: '0.0.0' });
    const documentManager = new DocumentManager();
    workspaceManager = new WorkspaceManager(documentManager);
    registerDefinitionTool(server, workspaceManager, documentManager);
    registerReferencesTool(server, workspaceManager, documentManager);
    registerHoverTool(server, workspaceManager, documentManager);
    registerSymbolsTool(server, workspaceManager, documentManager);
    registerImplementationTool(server, workspaceManager, documentManager);
    registerCallHierarchyTool(server, workspaceManager, documentManager);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'tools-test', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    // Start the language server and let it index the fixture project.
    await workspaceManager.getClient(utilsPath);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 30000);

  afterAll(async () => {
    await client.close();
    await workspaceManager.shutdownAll();
  }, 10000);

  it('lists the six tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'ts_call_hierarchy',
      'ts_definition',
      'ts_hover',
      'ts_implementation',
      'ts_references',
      'ts_symbols',
    ]);
  });

  it('ts_definition resolves a call to its declaration, 1-indexed', async () => {
    // index.ts line 3: `const message = greet('World');` — greet starts at column 17
    const { definitions } = await call<{ definitions: Entry[] }>('ts_definition', {
      file_path: indexPath,
      line: 3,
      column: 17,
    });
    expect(definitions.length).toBeGreaterThan(0);
    expect(path.resolve(definitions[0].file_path)).toBe(path.resolve(utilsPath));
    expect(definitions[0].line).toBe(1);
    expect(definitions[0].preview).toContain('function greet');
  });

  it('ts_definition returns an empty list on whitespace', async () => {
    const { definitions } = await call<{ definitions: Entry[] }>('ts_definition', {
      file_path: indexPath,
      line: 2,
      column: 1,
    });
    expect(definitions).toEqual([]);
  });

  it('ts_references includes the declaration by default and can leave it out', async () => {
    const args = { file_path: utilsPath, line: 1, column: 17 };
    const withDecl = await call<{ references: Entry[] }>('ts_references', args);
    const withoutDecl = await call<{ references: Entry[] }>('ts_references', {
      ...args,
      include_declaration: false,
    });

    const isDeclaration = (r: Entry) =>
      path.resolve(r.file_path) === path.resolve(utilsPath) && r.line === 1;
    expect(withDecl.references.some(isDeclaration)).toBe(true);
    expect(withoutDecl.references.some(isDeclaration)).toBe(false);
    expect(
      withDecl.references.some((r) => path.resolve(r.file_path) === path.resolve(indexPath)),
    ).toBe(true);
  });

  it('ts_hover returns the signature and its range', async () => {
    const { hover } = await call<{
      hover: { contents: string; range?: { start: { line: number; column: number } } } | null;
    }>('ts_hover', { file_path: utilsPath, line: 1, column: 17 });
    expect(hover).not.toBeNull();
    expect(hover!.contents).toContain('greet(name: string): string');
    expect(hover!.range?.start).toEqual({ line: 1, column: 17 });
  });

  it('ts_hover returns null on whitespace', async () => {
    const { hover } = await call<{ hover: unknown }>('ts_hover', {
      file_path: indexPath,
      line: 2,
      column: 1,
    });
    expect(hover).toBeNull();
  });

  it('ts_hover uses the content override instead of the file on disk', async () => {
    const content = 'export const answer: number = 42;\n';
    const scratchPath = path.join(fixtureRoot, 'src/in-memory-only.ts');
    const { hover } = await call<{ hover: { contents: string } | null }>('ts_hover', {
      file_path: scratchPath,
      line: 1,
      column: 14,
      content,
    });
    expect(hover?.contents).toContain('answer: number');
  });

  it('ts_symbols (file scope) flattens nested symbols with their container', async () => {
    const { symbols } = await call<{
      symbols: Array<{ name: string; kind: string; container: string | null }>;
    }>('ts_symbols', { query: '', file_path: servicesPath, scope: 'file' });
    expect(symbols).toContainEqual(
      expect.objectContaining({ name: 'FriendlyGreeter', kind: 'class', container: null }),
    );
    expect(symbols).toContainEqual(
      expect.objectContaining({ name: 'greet', kind: 'method', container: 'FriendlyGreeter' }),
    );
  });

  it('ts_symbols (file scope) filters by query, case-insensitively', async () => {
    const { symbols } = await call<{ symbols: Array<{ name: string }> }>('ts_symbols', {
      query: 'CALC',
      file_path: servicesPath,
      scope: 'file',
    });
    expect(symbols.map((s) => s.name)).toEqual(['SimpleCalculator']);
  });

  it('ts_symbols (workspace scope, the default) finds symbols in other files', async () => {
    const { symbols } = await call<{ symbols: Array<{ name: string; file_path: string }> }>(
      'ts_symbols',
      { query: 'FriendlyGreeter', file_path: utilsPath },
    );
    const match = symbols.find((s) => s.name === 'FriendlyGreeter');
    expect(match).toBeDefined();
    expect(path.resolve(match!.file_path)).toBe(path.resolve(servicesPath));
  });

  it('ts_implementation finds the classes implementing an interface', async () => {
    // interfaces.ts line 1: `export interface Greeter {` — Greeter starts at column 18
    const { implementations } = await call<{ implementations: Entry[] }>('ts_implementation', {
      file_path: interfacesPath,
      line: 1,
      column: 18,
    });
    expect(implementations.length).toBeGreaterThan(0);
    expect(path.resolve(implementations[0].file_path)).toBe(path.resolve(servicesPath));
    expect(implementations[0].preview).toContain('FriendlyGreeter');
  });

  it('ts_call_hierarchy (incoming) lists the callers with their call sites', async () => {
    const { calls } = await call<{
      calls: Array<Entry & { name: string; call_sites: Entry[] }>;
    }>('ts_call_hierarchy', { file_path: utilsPath, line: 1, column: 17, direction: 'incoming' });
    const fromIndex = calls.find((c) => path.resolve(c.file_path) === path.resolve(indexPath));
    expect(fromIndex).toBeDefined();
    expect(fromIndex!.call_sites).toContainEqual(expect.objectContaining({ line: 3, column: 17 }));
  });

  it('ts_call_hierarchy (outgoing) lists the callees, call sites in the source file', async () => {
    const content =
      "import { greet } from './utils.js';\nexport function run() {\n  return greet('x');\n}\n";
    const runPath = path.join(fixtureRoot, 'src/in-memory-run.ts');
    const { calls } = await call<{
      calls: Array<Entry & { name: string; call_sites: Entry[] }>;
    }>('ts_call_hierarchy', {
      file_path: runPath,
      line: 2,
      column: 17,
      direction: 'outgoing',
      content,
    });
    const greet = calls.find((c) => c.name === 'greet');
    expect(greet).toBeDefined();
    expect(path.resolve(greet!.file_path)).toBe(path.resolve(utilsPath));
    expect(path.resolve(greet!.call_sites[0].file_path)).toBe(path.resolve(runPath));
    expect(greet!.call_sites[0].line).toBe(3);
  });

  it('ts_call_hierarchy returns no calls where there is no function', async () => {
    const { calls } = await call<{ calls: unknown[] }>('ts_call_hierarchy', {
      file_path: indexPath,
      line: 2,
      column: 1,
      direction: 'incoming',
    });
    expect(calls).toEqual([]);
  });
});
