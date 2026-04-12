import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallHierarchyItem, CallHierarchyIncomingCall, CallHierarchyOutgoingCall, Range } from 'vscode-languageserver-protocol';
import type { WorkspaceManager } from '../workspace-manager.js';
import type { DocumentManager } from '../document-manager.js';
import { pathToUri, uriToPath, toLspPosition, fromLspPosition, getPreviewLine } from '../utils.js';

interface CallEntry {
  name: string;
  file_path: string;
  line: number;
  column: number;
  preview: string | null;
  call_sites: Array<{ file_path: string; line: number; column: number }>;
}

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

      // Process all prepared items, not just the first one
      const allCalls: CallEntry[] = [];
      for (const item of items) {
        if (direction === 'incoming') {
          const incoming = await client.callHierarchyIncomingCalls(item);
          allCalls.push(...formatIncomingCalls(incoming, documentManager));
        } else {
          const outgoing = await client.callHierarchyOutgoingCalls(item);
          allCalls.push(...formatOutgoingCalls(outgoing, item, documentManager));
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ calls: allCalls }) }],
      };
    },
  );
}

function rangeToCallSites(ranges: Range[], filePath: string): Array<{ file_path: string; line: number; column: number }> {
  return ranges.map((r) => {
    const pos = fromLspPosition(r.start);
    return { file_path: filePath, line: pos.line, column: pos.column };
  });
}

function formatIncomingCalls(
  calls: CallHierarchyIncomingCall[] | null,
  docManager: DocumentManager,
): CallEntry[] {
  if (!calls) return [];
  return calls.map((call) => {
    const entry = formatCallHierarchyItem(call.from, docManager);
    // fromRanges are in the caller's file (call.from)
    return { ...entry, call_sites: rangeToCallSites(call.fromRanges, entry.file_path) };
  });
}

function formatOutgoingCalls(
  calls: CallHierarchyOutgoingCall[] | null,
  sourceItem: CallHierarchyItem,
  docManager: DocumentManager,
): CallEntry[] {
  if (!calls) return [];
  // fromRanges for outgoing calls are in the source item's file, not in call.to's file
  const sourceFilePath = uriToPath(sourceItem.uri);
  return calls.map((call) => {
    const entry = formatCallHierarchyItem(call.to, docManager);
    return { ...entry, call_sites: rangeToCallSites(call.fromRanges, sourceFilePath) };
  });
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
