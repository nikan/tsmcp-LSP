import path from 'node:path';
import { existsSync } from 'node:fs';
import { LspClient } from './lsp-client.js';

/**
 * Maps file paths to workspace roots and manages per-root LSP client instances.
 */
export class WorkspaceManager {
  private clients: Map<string, LspClient> = new Map();
  private pending: Map<string, Promise<LspClient>> = new Map();

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
    if (existing) return existing;

    const inflight = this.pending.get(root);
    if (inflight) return inflight;

    const startup = (async () => {
      const client = new LspClient(root);
      await client.start();
      this.clients.set(root, client);
      this.pending.delete(root);
      return client;
    })();

    this.pending.set(root, startup);
    return startup;
  }

  /**
   * Shut down all managed LSP clients.
   */
  async shutdownAll(): Promise<void> {
    const shutdowns = Array.from(this.clients.values()).map((client) =>
      client.shutdown(),
    );
    await Promise.all(shutdowns);
    this.clients.clear();
  }

  /**
   * Get the number of active clients (for testing).
   */
  get clientCount(): number {
    return this.clients.size;
  }
}
