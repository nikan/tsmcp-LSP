import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  pathToUri,
  uriToPath,
  toLspPosition,
  fromLspPosition,
  getPreviewLine,
  DocumentContentProvider,
} from '../src/utils.js';

describe('pathToUri', () => {
  it('converts an absolute path to a file:// URI', () => {
    const uri = pathToUri('/home/user/project/file.ts');
    expect(uri).toBe('file:///home/user/project/file.ts');
  });

  it('encodes special characters', () => {
    const uri = pathToUri('/home/user/my project/file.ts');
    expect(uri).toContain('my%20project');
  });
});

describe('uriToPath', () => {
  it('converts a file:// URI to an absolute path', () => {
    const p = uriToPath('file:///home/user/project/file.ts');
    expect(p).toBe('/home/user/project/file.ts');
  });

  it('decodes special characters', () => {
    const p = uriToPath('file:///home/user/my%20project/file.ts');
    expect(p).toBe('/home/user/my project/file.ts');
  });
});

describe('toLspPosition', () => {
  it('converts 1-indexed to 0-indexed', () => {
    const pos = toLspPosition(1, 1);
    expect(pos).toEqual({ line: 0, character: 0 });
  });

  it('converts arbitrary position', () => {
    const pos = toLspPosition(10, 5);
    expect(pos).toEqual({ line: 9, character: 4 });
  });
});

describe('fromLspPosition', () => {
  it('converts 0-indexed to 1-indexed', () => {
    const pos = fromLspPosition({ line: 0, character: 0 });
    expect(pos).toEqual({ line: 1, column: 1 });
  });

  it('converts arbitrary position', () => {
    const pos = fromLspPosition({ line: 9, character: 4 });
    expect(pos).toEqual({ line: 10, column: 5 });
  });
});

describe('getPreviewLine', () => {
  const fixtureFile = path.resolve(
    import.meta.dirname,
    'fixtures/sample-project/src/utils.ts',
  );

  it('reads a line from disk', () => {
    const line = getPreviewLine(fixtureFile, 1);
    expect(line).toBe('export function greet(name: string): string {');
  });

  it('reads another line from disk', () => {
    const line = getPreviewLine(fixtureFile, 2);
    expect(line).toBe('  return `Hello, ${name}!`;');
  });

  it('returns null for out-of-range line', () => {
    const line = getPreviewLine(fixtureFile, 999);
    expect(line).toBeNull();
  });

  it('returns null for non-existent file', () => {
    const line = getPreviewLine('/nonexistent/file.ts', 1);
    expect(line).toBeNull();
  });

  it('prefers in-memory content from documentManager', () => {
    const mockManager: DocumentContentProvider = {
      getContent(uri: string): string | null {
        if (uri === pathToUri(fixtureFile)) {
          return 'overridden line 1\noverridden line 2';
        }
        return null;
      },
    };
    const line = getPreviewLine(fixtureFile, 1, mockManager);
    expect(line).toBe('overridden line 1');
  });

  it('falls back to disk when documentManager returns null', () => {
    const mockManager: DocumentContentProvider = {
      getContent(): string | null {
        return null;
      },
    };
    const line = getPreviewLine(fixtureFile, 1, mockManager);
    expect(line).toBe('export function greet(name: string): string {');
  });
});
