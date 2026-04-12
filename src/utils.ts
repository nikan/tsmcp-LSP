import { Position } from 'vscode-languageserver-protocol';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Convert an absolute file path to a file:// URI.
 */
export function pathToUri(absPath: string): string {
  return pathToFileURL(absPath).toString();
}

/**
 * Convert a file:// URI to an absolute file path.
 */
export function uriToPath(uri: string): string {
  return fileURLToPath(uri);
}

/**
 * Convert 1-indexed line/column to 0-indexed LSP Position.
 */
export function toLspPosition(line: number, column: number): Position {
  return { line: line - 1, character: column - 1 };
}

/**
 * Convert 0-indexed LSP Position to 1-indexed line/column.
 */
export function fromLspPosition(pos: Position): { line: number; column: number } {
  return { line: pos.line + 1, column: pos.character + 1 };
}

/**
 * DocumentManager interface — used to decouple utils from the actual document manager.
 */
export interface DocumentContentProvider {
  getContent(uri: string): string | null;
}

/**
 * Get a preview line from a file. Uses in-memory content from documentManager
 * if available, otherwise reads from disk. Line is 1-indexed.
 * Returns the trimmed line content, or null if the line doesn't exist.
 */
export function getPreviewLine(
  filePath: string,
  line: number,
  documentManager?: DocumentContentProvider,
): string | null {
  const uri = pathToUri(filePath);

  // Try in-memory content first
  if (documentManager) {
    const content = documentManager.getContent(uri);
    if (content !== null) {
      const lines = content.split('\n');
      const idx = line - 1;
      if (idx >= 0 && idx < lines.length) {
        return lines[idx];
      }
      return null;
    }
  }

  // Fall back to reading from disk
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const idx = line - 1;
    if (idx >= 0 && idx < lines.length) {
      return lines[idx];
    }
    return null;
  } catch {
    return null;
  }
}
