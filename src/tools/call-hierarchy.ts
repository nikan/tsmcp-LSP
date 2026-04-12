import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallHierarchyItem, CallHierarchyIncomingCall, CallHierarchyOutgoingCall } from 'vscode-languageserver-protocol';
import type { WorkspaceManager } from '../workspace-manager.js';
import type { DocumentManager } from '../document-manager.js';
import { pathToUri, uriToPath, toLspPosition, fromLspPosition, getPreviewLine } from '../utils.js';

export function registerCallHierarchyTool(
  server: McpServer,
  workspaceManager: WorkspaceManager,
  documentManager: DocumentManager,
): void {
  server.registerTool(
    'ts_call_hierarchy',
    {
      description: 'Find incoming or outgoing calls for a TypeScript/JavaScript function',
      inputSchema: {
        file_path: z.string().describe('Absolute path to the file'),
        line: z.number().describe('Line number (1-indexed)'),
        column: z.number().describe('Column number (1-indexed)'),
        direction: z.enum(['incoming', 'outgoing']).describe('Direction: "incoming" finds callers, "outgoing" finds callees'),
        content: z.string().optional().describe('Optional file content override'),
      },
    },
    async ({ file_path, line, column, direction, content }) => {
      const filePath = path.resolve(file_path);
      const client = await workspaceManager.getClient(filePath);
      const uri = pathToUri(filePath);
      await documentManager.ensureOpen(uri, client.getConnection(), content);

      const lspPos = toLspPosition(line, column);
      const items = await client.prepareCallHierarchy(uri, lspPos.line, lspPos.character);

      if (!items || items.length === 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ calls: [] }) }],
        };
      }

      const item = items[0];
      let calls: Array<{ name: string; file_path: string; line: number; column: number; preview: string | null }>;

      if (direction === 'incoming') {
        const incoming = await client.callHierarchyIncomingCalls(item);
        calls = formatIncomingCalls(incoming, documentManager);
      } else {
        const outgoing = await client.callHierarchyOutgoingCalls(item);
        calls = formatOutgoingCalls(outgoing, documentManager);
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ calls }) }],
      };
    },
  );
}

function formatIncomingCalls(
  calls: CallHierarchyIncomingCall[] | null,
  docManager: DocumentManager,
): Array<{ name: string; file_path: string; line: number; column: number; preview: string | null }> {
  if (!calls) return [];
  return calls.map((call) => formatCallHierarchyItem(call.from, docManager));
}

function formatOutgoingCalls(
  calls: CallHierarchyOutgoingCall[] | null,
  docManager: DocumentManager,
): Array<{ name: string; file_path: string; line: number; column: number; preview: string | null }> {
  if (!calls) return [];
  return calls.map((call) => formatCallHierarchyItem(call.to, docManager));
}

function formatCallHierarchyItem(
  item: CallHierarchyItem,
  docManager: DocumentManager,
): { name: string; file_path: string; line: number; column: number; preview: string | null } {
  const filePath = uriToPath(item.uri);
  const pos = fromLspPosition(item.selectionRange.start);
  const preview = getPreviewLine(filePath, pos.line, docManager);
  return { name: item.name, file_path: filePath, line: pos.line, column: pos.column, preview };
}
