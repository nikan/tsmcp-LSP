import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  SymbolKind,
  type SymbolInformation,
  type DocumentSymbol,
  type WorkspaceSymbol,
} from 'vscode-languageserver-protocol';
import type { WorkspaceManager } from '../workspace-manager.js';
import type { DocumentManager } from '../document-manager.js';
import { pathToUri, uriToPath, fromLspPosition } from '../utils.js';

const SYMBOL_KIND_NAMES: Record<number, string> = {
  [SymbolKind.File]: 'file',
  [SymbolKind.Module]: 'module',
  [SymbolKind.Namespace]: 'namespace',
  [SymbolKind.Package]: 'package',
  [SymbolKind.Class]: 'class',
  [SymbolKind.Method]: 'method',
  [SymbolKind.Property]: 'property',
  [SymbolKind.Field]: 'field',
  [SymbolKind.Constructor]: 'constructor',
  [SymbolKind.Enum]: 'enum',
  [SymbolKind.Interface]: 'interface',
  [SymbolKind.Function]: 'function',
  [SymbolKind.Variable]: 'variable',
  [SymbolKind.Constant]: 'constant',
  [SymbolKind.String]: 'string',
  [SymbolKind.Number]: 'number',
  [SymbolKind.Boolean]: 'boolean',
  [SymbolKind.Array]: 'array',
  [SymbolKind.Object]: 'object',
  [SymbolKind.Key]: 'key',
  [SymbolKind.Null]: 'null',
  [SymbolKind.EnumMember]: 'enum-member',
  [SymbolKind.Struct]: 'struct',
  [SymbolKind.Event]: 'event',
  [SymbolKind.Operator]: 'operator',
  [SymbolKind.TypeParameter]: 'type-parameter',
};

interface SymbolEntry {
  name: string;
  kind: string;
  file_path: string;
  line: number;
  column: number;
  container: string | null;
}

function symbolKindName(kind: SymbolKind): string {
  return SYMBOL_KIND_NAMES[kind] ?? 'unknown';
}

function flattenDocumentSymbols(
  symbols: DocumentSymbol[],
  filePath: string,
  container: string | null,
): SymbolEntry[] {
  const result: SymbolEntry[] = [];
  for (const sym of symbols) {
    const pos = fromLspPosition(sym.selectionRange.start);
    result.push({
      name: sym.name,
      kind: symbolKindName(sym.kind),
      file_path: filePath,
      line: pos.line,
      column: pos.column,
      container,
    });
    if (sym.children && sym.children.length > 0) {
      result.push(...flattenDocumentSymbols(sym.children, filePath, sym.name));
    }
  }
  return result;
}

function isDocumentSymbolArray(
  result: SymbolInformation[] | DocumentSymbol[],
): result is DocumentSymbol[] {
  return result.length > 0 && 'selectionRange' in result[0];
}

export function registerSymbolsTool(
  server: McpServer,
  workspaceManager: WorkspaceManager,
  documentManager: DocumentManager,
): void {
  server.registerTool(
    'ts_symbols',
    {
      description:
        'Search for symbols in a file (document symbols) or across the workspace (workspace symbols)',
      inputSchema: {
        query: z.string().describe('Symbol name or prefix to search for'),
        file_path: z
          .string()
          .describe(
            'Absolute path to a file. For file scope, returns symbols in this file. For workspace scope, determines the workspace root to search.',
          ),
        scope: z
          .enum(['file', 'workspace'])
          .optional()
          .describe('Search scope: "file" for document symbols, "workspace" for workspace-wide (default: "workspace")'),
      },
    },
    async ({ query, file_path, scope }) => {
      const filePath = path.resolve(file_path);
      const client = await workspaceManager.getClient(filePath);
      const uri = pathToUri(filePath);
      const effectiveScope = scope ?? 'workspace';

      let symbols: SymbolEntry[];

      if (effectiveScope === 'file') {
        await documentManager.ensureOpen(uri, client.getConnection());
        const result = await client.documentSymbol(uri);
        if (!result || result.length === 0) {
          symbols = [];
        } else if (isDocumentSymbolArray(result)) {
          symbols = flattenDocumentSymbols(result, filePath, null);
        } else {
          // SymbolInformation[]
          symbols = (result as SymbolInformation[]).map((sym) => ({
            name: sym.name,
            kind: symbolKindName(sym.kind),
            file_path: sym.location ? uriToPath(sym.location.uri) : filePath,
            line: sym.location ? fromLspPosition(sym.location.range.start).line : 1,
            column: sym.location ? fromLspPosition(sym.location.range.start).column : 1,
            container: sym.containerName ?? null,
          }));
        }

        // Filter by query (case-insensitive substring match)
        if (query) {
          const lowerQuery = query.toLowerCase();
          symbols = symbols.filter((s) => s.name.toLowerCase().includes(lowerQuery));
        }
      } else {
        // workspace scope
        const result = await client.workspaceSymbol(query);
        if (!result || result.length === 0) {
          symbols = [];
        } else {
          symbols = (result as (SymbolInformation | WorkspaceSymbol)[]).map((sym) => {
            const loc = sym.location;
            let symFilePath: string;
            let line: number;
            let column: number;

            if ('range' in loc) {
              // SymbolInformation location: { uri, range }
              symFilePath = uriToPath(loc.uri);
              const range = (loc as { uri: string; range: { start: { line: number; character: number } } }).range;
              const pos = fromLspPosition(range.start);
              line = pos.line;
              column = pos.column;
            } else {
              // WorkspaceSymbol location: { uri } only (no range)
              symFilePath = uriToPath((loc as { uri: string }).uri);
              line = 1;
              column = 1;
            }

            return {
              name: sym.name,
              kind: symbolKindName(sym.kind),
              file_path: symFilePath,
              line,
              column,
              container: sym.containerName ?? null,
            };
          });
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ symbols }) }],
      };
    },
  );
}
