import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WorkspaceManager } from '../workspace-manager.js';
import type { DocumentManager } from '../document-manager.js';
import { pathToUri, uriToPath, toLspPosition, fromLspPosition, getPreviewLine } from '../utils.js';

export function registerReferencesTool(
  server: McpServer,
  workspaceManager: WorkspaceManager,
  documentManager: DocumentManager,
): void {
  server.registerTool(
    'ts_references',
    {
      description: 'Find all references of a TypeScript/JavaScript symbol',
      inputSchema: {
        file_path: z.string().describe('Absolute path to the file'),
        line: z.number().describe('Line number (1-indexed)'),
        column: z.number().describe('Column number (1-indexed)'),
        content: z.string().optional().describe('Optional file content override'),
        include_declaration: z.boolean().optional().describe('Include the declaration in results (default: true)'),
      },
    },
    async ({ file_path, line, column, content, include_declaration }) => {
      const filePath = path.resolve(file_path);
      const client = await workspaceManager.getClient(filePath);
      const uri = pathToUri(filePath);
      await documentManager.ensureOpen(uri, client.getConnection(), content);

      const lspPos = toLspPosition(line, column);
      const includeDecl = include_declaration !== undefined ? include_declaration : true;
      const result = await client.references(uri, lspPos.line, lspPos.character, includeDecl);

      const references = (result ?? []).map((loc) => {
        const refPath = uriToPath(loc.uri);
        const pos = fromLspPosition(loc.range.start);
        const preview = getPreviewLine(refPath, pos.line, documentManager);
        return { file_path: refPath, line: pos.line, column: pos.column, preview };
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ references }) }],
      };
    },
  );
}
