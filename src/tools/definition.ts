import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Location, LocationLink } from 'vscode-languageserver-protocol';
import type { WorkspaceManager } from '../workspace-manager.js';
import type { DocumentManager } from '../document-manager.js';
import { pathToUri, uriToPath, toLspPosition, fromLspPosition, getPreviewLine } from '../utils.js';

export function registerDefinitionTool(
  server: McpServer,
  workspaceManager: WorkspaceManager,
  documentManager: DocumentManager,
): void {
  server.registerTool(
    'ts_definition',
    {
      description: 'Go to definition of a TypeScript/JavaScript symbol',
      inputSchema: {
        file_path: z.string().describe('Absolute path to the file'),
        line: z.number().describe('Line number (1-indexed)'),
        column: z.number().describe('Column number (1-indexed)'),
        content: z.string().optional().describe('Optional file content override'),
      },
    },
    async ({ file_path, line, column, content }) => {
      const filePath = path.resolve(file_path);
      const client = await workspaceManager.getClient(filePath);
      const uri = pathToUri(filePath);
      await documentManager.ensureOpen(uri, client.getConnection(), content);

      const lspPos = toLspPosition(line, column);
      const result = await client.definition(uri, lspPos.line, lspPos.character);

      const definitions = normalizeDefinitionResult(result, documentManager);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ definitions }) }],
      };
    },
  );
}

function normalizeDefinitionResult(
  result: Location | Location[] | LocationLink[] | null | undefined,
  docManager: DocumentManager,
): Array<{ file_path: string; line: number; column: number; preview: string | null }> {
  if (!result) return [];

  // Single Location
  if (!Array.isArray(result)) {
    return [locationToEntry(result as Location, docManager)];
  }

  // Empty array
  if (result.length === 0) return [];

  // Discriminate: LocationLink has targetUri, Location has uri
  const first = result[0];
  if ('targetUri' in first) {
    // LocationLink[]
    return (result as LocationLink[]).map((link) => {
      const filePath = uriToPath(link.targetUri);
      const pos = fromLspPosition(link.targetSelectionRange.start);
      const preview = getPreviewLine(filePath, pos.line, docManager);
      return { file_path: filePath, line: pos.line, column: pos.column, preview };
    });
  }

  // Location[]
  return (result as Location[]).map((loc) => locationToEntry(loc, docManager));
}

function locationToEntry(
  loc: Location,
  docManager: DocumentManager,
): { file_path: string; line: number; column: number; preview: string | null } {
  const filePath = uriToPath(loc.uri);
  const pos = fromLspPosition(loc.range.start);
  const preview = getPreviewLine(filePath, pos.line, docManager);
  return { file_path: filePath, line: pos.line, column: pos.column, preview };
}
