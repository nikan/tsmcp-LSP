import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import { WorkspaceManager } from '../src/workspace-manager.js';

const fixtureRoot = path.resolve(
  import.meta.dirname,
  'fixtures/sample-project',
);

describe('WorkspaceManager', () => {
  let manager: WorkspaceManager;

  afterEach(async () => {
    if (manager) {
      await manager.shutdownAll();
    }
  });

  describe('findRoot', () => {
    it('finds root with tsconfig.json', () => {
      manager = new WorkspaceManager();
      const root = manager.findRoot(
        path.join(fixtureRoot, 'src/index.ts'),
      );
      expect(root).toBe(fixtureRoot);
    });

    it('finds root from nested directory', () => {
      manager = new WorkspaceManager();
      const root = manager.findRoot(
        path.join(fixtureRoot, 'src/utils.ts'),
      );
      expect(root).toBe(fixtureRoot);
    });

    it('falls back to file directory when no config found', () => {
      manager = new WorkspaceManager();
      const root = manager.findRoot('/tmp/noconfig/file.ts');
      expect(root).toBe('/tmp/noconfig');
    });
  });

  describe('getClient', () => {
    it('creates a client for a file in the fixture', async () => {
      manager = new WorkspaceManager();
      const client = await manager.getClient(
        path.join(fixtureRoot, 'src/index.ts'),
      );
      expect(client).toBeDefined();
      expect(client.isInitialized).toBe(true);
      expect(manager.clientCount).toBe(1);
    }, 15000);

    it('reuses the same client for files in the same root', async () => {
      manager = new WorkspaceManager();
      const client1 = await manager.getClient(
        path.join(fixtureRoot, 'src/index.ts'),
      );
      const client2 = await manager.getClient(
        path.join(fixtureRoot, 'src/utils.ts'),
      );
      expect(client1).toBe(client2);
      expect(manager.clientCount).toBe(1);
    }, 15000);
  });

  describe('shutdownAll', () => {
    it('shuts down all clients', async () => {
      manager = new WorkspaceManager();
      await manager.getClient(path.join(fixtureRoot, 'src/index.ts'));
      expect(manager.clientCount).toBe(1);
      await manager.shutdownAll();
      expect(manager.clientCount).toBe(0);
    }, 15000);
  });
});
