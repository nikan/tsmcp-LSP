import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Hover, MarkupContent, MarkedString } from 'vscode-languageserver-protocol';
import type { WorkspaceManager } from '../workspace-manager.js';
import type { DocumentManager } from '../document-manager.js';
import { pathToUri, toLspPosition, fromLspPosition } from '../utils.js';

export function registerHoverTool(
  server: McpServer,
  workspaceManager: WorkspaceManager,
  documentManager: DocumentManager,
): void {
  server.registerTool(
    'ts_hover',
    {
      description: 'Get hover/type information for a TypeScript/JavaScript symbol',
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
      const result = await client.hover(uri, lspPos.line, lspPos.character);

      if (!result) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ hover: null }) }],
        };
      }

      const hover = normalizeHoverResult(result);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ hover }) }],
      };
    },
  );
}

interface HoverResult {
  contents: string;
  language?: string;
  range?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

function normalizeHoverResult(hover: Hover): HoverResult {
  const { contents, language } = extractContents(hover.contents);

  const result: HoverResult = { contents };
  if (language) result.language = language;

  if (hover.range) {
    result.range = {
      start: fromLspPosition(hover.range.start),
      end: fromLspPosition(hover.range.end),
    };
  }

  return result;
}

function extractContents(
  contents: MarkupContent | MarkedString | MarkedString[],
): { contents: string; language?: string } {
  // MarkupContent: { kind, value }
  if (typeof contents === 'object' && 'kind' in contents) {
    return { contents: (contents as MarkupContent).value };
  }

  // string (MarkedString)
  if (typeof contents === 'string') {
    return { contents };
  }

  // { language, value } (MarkedString object form)
  if (typeof contents === 'object' && !Array.isArray(contents) && 'language' in contents) {
    const ms = contents as { language: string; value: string };
    return { contents: ms.value, language: ms.language };
  }

  // MarkedString[]
  if (Array.isArray(contents)) {
    const parts: string[] = [];
    let language: string | undefined;
    for (const item of contents) {
      if (typeof item === 'string') {
        parts.push(item);
      } else {
        parts.push(item.value);
        if (!language && item.language) {
          language = item.language;
        }
      }
    }
    const result: { contents: string; language?: string } = { contents: parts.join('\n') };
    if (language) result.language = language;
    return result;
  }

  return { contents: String(contents) };
}
