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
});
