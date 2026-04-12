import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { LspClient } from './lsp-client.js';
import type { DocumentManager } from './document-manager.js';
import { pathToUri } from './utils.js';

const SCOPE_FILE_LIMIT = 1000;

/**
 * Maps file paths to workspace roots and manages per-root LSP client instances.
 */
export class WorkspaceManager {
  private clients: Map<string, LspClient> = new Map();
  private pending: Map<string, Promise<LspClient>> = new Map();
  private broadened: Set<string> = new Set();
  private documentManager: DocumentManager | null;

  constructor(documentManager?: DocumentManager) {
    this.documentManager = documentManager ?? null;
  }

  /**
   * Find the workspace root for a given file path.
   * Walks up directories looking for tsconfig.json or jsconfig.json.
   * Falls back to the file's own directory.
   */
  findRoot(filePath: string): string {
    let dir = path.dirname(filePath);
    const root = path.parse(dir).root;

    while (true) {
      if (existsSync(path.join(dir, 'tsconfig.json'))) {
        return dir;
      }
      if (existsSync(path.join(dir, 'jsconfig.json'))) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir || dir === root) {
        // Reached filesystem root without finding config
        return path.dirname(filePath);
      }
      dir = parent;
    }
  }

  /**
   * Get or create an LSP client for the workspace root of the given file.
   */
  async getClient(filePath: string): Promise<LspClient> {
    const root = this.findRoot(filePath);
    const existing = this.clients.get(root);
    if (existing && existing.isInitialized) return existing;
    if (existing) this.clients.delete(root);

    const inflight = this.pending.get(root);
    if (inflight) return inflight;

    const startup = (async () => {
      try {
        const client = new LspClient(root);
        await client.start();
        this.clients.set(root, client);
        await this.broadenScope(root, client);
        return client;
      } finally {
        this.pending.delete(root);
      }
    })();

    this.pending.set(root, startup);
    return startup;
  }

  /**
   * Shut down all managed LSP clients.
   */
  async shutdownAll(): Promise<void> {
    // Wait for any in-flight startups, then shut them down too
    const pendingClients = Array.from(this.pending.values()).map((p) =>
      p.then((client) => client.shutdown()).catch(() => {}),
    );
    const activeClients = Array.from(this.clients.values()).map((client) =>
      client.shutdown(),
    );
    await Promise.all([...activeClients, ...pendingClients]);
    this.clients.clear();
    this.pending.clear();
  }

  /**
   * Get the number of active clients (for testing).
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Open all TypeScript/JavaScript files in the workspace root so the LSP
   * server is aware of files outside the tsconfig scope (e.g. test files).
   * This enables cross-scope references and workspace symbol search.
   */
  private async broadenScope(root: string, client: LspClient): Promise<void> {
    if (this.broadened.has(root) || !this.documentManager) return;
    this.broadened.add(root);

    const files = this.findTypeScriptFiles(root);
    if (files.length === 0 || files.length > SCOPE_FILE_LIMIT) return;

    const conn = client.getConnection();
    for (const filePath of files) {
      const uri = pathToUri(filePath);
      await this.documentManager.ensureOpen(uri, conn);
    }
  }

  /**
   * Recursively find all .ts/.tsx files under a directory,
   * skipping node_modules, dist, and declaration files.
   */
  private findTypeScriptFiles(root: string): string[] {
    const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);
    const results: string[] = [];

    const walk = (dir: string): void => {
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) {
            walk(path.join(dir, entry.name));
          }
        } else if (entry.isFile()) {
          const name = entry.name;
          if ((name.endsWith('.ts') || name.endsWith('.tsx')) && !name.endsWith('.d.ts')) {
            results.push(path.join(dir, name));
          }
        }
        if (results.length > SCOPE_FILE_LIMIT) return;
      }
    };

    walk(root);
    return results;
  }
}
