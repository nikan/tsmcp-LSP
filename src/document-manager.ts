import { readFileSync } from 'node:fs';
import {
  DidOpenTextDocumentNotification,
  DidChangeTextDocumentNotification,
  type ProtocolConnection,
} from 'vscode-languageserver-protocol/node.js';
import { uriToPath, type DocumentContentProvider } from './utils.js';

interface DocumentState {
  uri: string;
  version: number;
  content: string;
  isOpen: boolean;
}

/**
 * Manages document lifecycle for LSP (didOpen/didChange).
 * Tracks in-memory content and versions.
 */
export class DocumentManager implements DocumentContentProvider {
  private documents: Map<string, DocumentState> = new Map();

  /**
   * Ensure a document is open in the LSP server.
   * If not yet open, reads from disk (or uses provided content) and sends didOpen.
   * If already open and content differs, sends didChange.
   */
  async ensureOpen(
    uri: string,
    connection: ProtocolConnection,
    content?: string,
  ): Promise<void> {
    const existing = this.documents.get(uri);

    if (!existing || !existing.isOpen) {
      // Need to open the document
      let text: string;
      if (content !== undefined) {
        text = content;
      } else {
        const filePath = uriToPath(uri);
        text = readFileSync(filePath, 'utf-8');
      }

      const version = existing ? existing.version + 1 : 1;

      connection.sendNotification(DidOpenTextDocumentNotification.type, {
        textDocument: {
          uri,
          languageId: this.detectLanguageId(uri),
          version,
          text,
        },
      });

      this.documents.set(uri, {
        uri,
        version,
        content: text,
        isOpen: true,
      });
      return;
    }

    // Already open — check if content differs
    if (content !== undefined && content !== existing.content) {
      const newVersion = existing.version + 1;

      connection.sendNotification(DidChangeTextDocumentNotification.type, {
        textDocument: {
          uri,
          version: newVersion,
        },
        contentChanges: [{ text: content }],
      });

      this.documents.set(uri, {
        uri,
        version: newVersion,
        content,
        isOpen: true,
      });
    }
  }

  /**
   * Get the in-memory content for a document, or null if not open.
   */
  getContent(uri: string): string | null {
    const doc = this.documents.get(uri);
    if (doc && doc.isOpen) {
      return doc.content;
    }
    return null;
  }

  /**
   * Check if a document is currently open.
   */
  isOpen(uri: string): boolean {
    const doc = this.documents.get(uri);
    return doc !== undefined && doc.isOpen;
  }

  /**
   * Get the current version of a document, or null if not tracked.
   */
  getVersion(uri: string): number | null {
    const doc = this.documents.get(uri);
    return doc ? doc.version : null;
  }

  /**
   * Detect the language ID from a URI.
   */
  private detectLanguageId(uri: string): string {
    if (uri.endsWith('.tsx')) return 'typescriptreact';
    if (uri.endsWith('.ts')) return 'typescript';
    if (uri.endsWith('.jsx')) return 'javascriptreact';
    if (uri.endsWith('.js')) return 'javascript';
    if (uri.endsWith('.json')) return 'json';
    return 'plaintext';
  }
}
