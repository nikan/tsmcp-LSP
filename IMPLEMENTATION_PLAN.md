# MCP Server for TypeScript LSP — Implementation Plan

## Overview

An MCP server that exposes TypeScript semantic analysis (go-to-definition, find-references, hover, symbol search) as tools for AI agents like Claude Code and Mistral Vibe.

**Key decisions:**
- **Language:** TypeScript (single Node.js runtime, aligns with target ecosystem)
- **MCP layer:** `@modelcontextprotocol/sdk` (no hand-rolled JSON-RPC)
- **LSP client:** `vscode-languageserver-protocol` + `vscode-jsonrpc` for typed LSP messages and JSON-RPC transport over a manually spawned child process. **Not** `vscode-languageclient`, which depends on VS Code extension APIs unusable in a standalone Node process.
- **LSP backend:** `typescript-language-server` (wraps `tsserver`), pinned as a local dependency
- **Transport:** stdio
- **Server topology:** One `typescript-language-server` instance per workspace root (see Workspace Management below)

---

## Project Structure

```
tsmcp-lsp/
├── src/
│   ├── index.ts              # Entry point — MCP server setup
│   ├── lsp-client.ts         # LSP client: spawns child process, uses vscode-jsonrpc for transport
│   ├── workspace-manager.ts  # Maps file paths → workspace roots, manages per-root LSP instances
│   ├── document-manager.ts   # Document open/change/close lifecycle + in-memory content
│   ├── tools/
│   │   ├── definition.ts     # ts_definition tool
│   │   ├── references.ts     # ts_references tool
│   │   ├── hover.ts          # ts_hover tool
│   │   └── symbols.ts        # ts_symbols tool (Milestone 2)
│   └── utils.ts              # URI↔path conversion, preview extraction (prefers in-memory content)
├── tests/
│   ├── smoke.test.ts         # End-to-end: initialize → tool call → shutdown
│   ├── tools.test.ts         # Individual tool tests against real tsserver
│   └── fixtures/             # Small TS projects for testing
│       └── sample-project/
│           ├── tsconfig.json
│           └── src/
│               ├── index.ts
│               └── utils.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Tool Contracts

All position-based tools accept **1-indexed** `line` and `column` (matching what agents and editors use). The server converts to 0-indexed internally for LSP.

### ts_definition

Find where a symbol is defined.

**Input:**
```json
{
  "file_path": "/project/src/index.ts",
  "line": 10,
  "column": 5,
  "content": "optional — current buffer content for unsaved files"
}
```
- `file_path` (required): Absolute path to the file
- `line` (required): 1-indexed line number
- `column` (required): 1-indexed column number
- `content` (optional): Current file content for unsaved buffers. **MVP limitation:** only the queried file's unsaved state is synced; cross-file unsaved edits are not reflected.

**Output:**
```json
{
  "definitions": [
    {
      "file_path": "/project/src/utils.ts",
      "line": 3,
      "column": 17,
      "preview": "export function greet(name: string): string {"
    }
  ]
}
```

### ts_references

Find all references to a symbol.

**Input:** Same as `ts_definition`, plus:
- `include_declaration` (optional, default `true`): Include the declaration site

**Output:**
```json
{
  "references": [
    {
      "file_path": "/project/src/index.ts",
      "line": 10,
      "column": 5,
      "preview": "const result = greet('world');"
    }
  ]
}
```

### ts_hover

Get type information and documentation for a symbol.

**Input:** Same as `ts_definition`.

**Output:**
```json
{
  "hover": {
    "contents": "function greet(name: string): string",
    "language": "typescript",
    "range": {
      "start": { "line": 10, "column": 5 },
      "end": { "line": 10, "column": 10 }
    }
  }
}
```

### ts_symbols (Milestone 2)

Search for symbols in a file or workspace.

**Input:**
```json
{
  "query": "greet",
  "file_path": "/project/src/utils.ts"
}
```
- `query` (required): Symbol name or prefix to search for
- `file_path` (required): Absolute path to a file. For **document symbols**, returns symbols defined in this file. For **workspace symbols**, this file determines which workspace root to search (via the workspace manager's root discovery). The search covers the entire workspace, not just this file.
- `scope` (optional, default `"workspace"`): `"file"` for document symbols only, `"workspace"` for workspace-wide search

**Output:**
```json
{
  "symbols": [
    {
      "name": "greet",
      "kind": "function",
      "file_path": "/project/src/utils.ts",
      "line": 3,
      "column": 17,
      "container": "utils"
    }
  ]
}
```

---

## Architecture

### MCP Server (`src/index.ts`)

Uses `@modelcontextprotocol/sdk` to register tools and handle the MCP lifecycle. The SDK manages JSON-RPC, stdio transport, initialize/shutdown, and tool discovery automatically.

```
Agent ↔ [stdio/MCP SDK] ↔ MCP Server ↔ LSP Client ↔ [stdio] ↔ typescript-language-server
```

### LSP Client (`src/lsp-client.ts`)

Spawns `typescript-language-server --stdio` as a child process. Uses `vscode-jsonrpc` (`createMessageConnection` over `StreamMessageReader`/`StreamMessageWriter`) for JSON-RPC transport — this handles message framing (Content-Length headers), request/response ID matching, and notification dispatch. Uses `vscode-languageserver-protocol` for typed LSP request/response definitions (e.g., `DefinitionRequest`, `HoverRequest`).

**What it does:**
- Spawns the child process via `child_process.spawn()`
- Creates a `MessageConnection` from the process's stdin/stdout
- Sends `initialize` with the workspace `rootUri` and client capabilities
- Exposes typed methods: `definition()`, `references()`, `hover()`, `documentSymbol()`, `workspaceSymbol()`
- Handles `shutdown` + `exit` lifecycle

**What it does NOT do:** No custom framing, no manual ID tracking, no byte-level buffer parsing. `vscode-jsonrpc` handles all of that.

### Workspace Manager (`src/workspace-manager.ts`)

Manages the mapping from file paths to workspace roots and lazily creates one LSP client instance per root.

**Workspace root discovery (MVP):**
1. Given a `file_path`, walk up the directory tree looking for `tsconfig.json` or `jsconfig.json` (first match wins)
2. The directory containing the nearest config file is the workspace root
3. If neither found, fall back to the directory of the file itself

**MVP scope limitation:** This handles standard single-`tsconfig.json` projects and `jsconfig.json`-based JS projects. It does **not** handle solution-style `tsconfig.json` (with `references`), custom config names (e.g., `tsconfig.build.json`), or monorepo setups with multiple overlapping configs. These are deferred — the nearest-ancestor heuristic is correct for the vast majority of single-project agent workflows.

**Instance lifecycle:**
- First tool call for a workspace root → spawn a new `typescript-language-server`, initialize with that `rootUri`
- Subsequent calls for the same root → reuse the existing instance
- On MCP server shutdown → shut down all LSP instances

**Why per-root:** TypeScript's type resolution depends on `tsconfig.json` context. A single LSP instance initialized with the wrong `rootUri` will produce incorrect definitions and references for files in other projects or nested configs.

**MVP simplification:** Most agent workflows target a single project. The per-root design handles the common case (one instance) efficiently while being correct for multi-root scenarios without additional complexity.

### Document Manager (`src/document-manager.ts`)

Tracks which files are open in each LSP server instance, their versions, and their **in-memory content**. Implements "open-if-missing, update-if-exists" semantics:

1. Tool receives `file_path` + optional `content`
2. If document not open → send `textDocument/didOpen` with content (read from disk if not provided)
3. If document open and `content` differs → send `textDocument/didChange` with new content
4. If document open and no `content` → use existing state

State machine: `CLOSED → didOpen → OPEN → didChange → DIRTY → didClose → CLOSED`

**In-memory content store:** The document manager retains the latest content for every open document. This content is used by preview extraction (see below) so that previews for dirty files reflect the unsaved state, not stale disk content.

**Unsaved buffer scope (MVP limitation):** Each tool call accepts `content` for the **single file** being queried. This means cross-file unsaved edits (e.g., a changed interface definition in file A affecting references in file B) are not supported — only the queried file's unsaved state is synced to the LSP server. This is documented in tool descriptions. Multi-file dirty-state sync is deferred to a future milestone where a `ts_sync_documents` batch tool could accept multiple file/content pairs.

### Response Enrichment (`src/utils.ts`)

- Convert `file://` URIs to absolute file paths in all responses
- Convert 0-indexed LSP positions to 1-indexed in responses
- Extract source preview lines: **prefer in-memory content from the document manager** for files that are open with unsaved changes; fall back to reading from disk for files not in the document manager
- Helper: `uriToPath()`, `pathToUri()`, `getPreviewLine(filePath, line, documentManager)`

---

## MVP Scope

### Milestone 1: Core Navigation
- `ts_definition` → LSP `textDocument/definition`
- `ts_references` → LSP `textDocument/references`
- `ts_hover` → LSP `textDocument/hover`

### Milestone 2: Symbol Search
- `ts_symbols` → LSP `workspace/symbol` + `textDocument/documentSymbol`

### Deferred (future milestones)
- `ts_rename` — complex workspace edits
- `ts_diagnostics` — requires notification streaming
- Call hierarchy, implementations, code actions

---

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "vscode-languageserver-protocol": "^3.17.0",
    "vscode-jsonrpc": "^8.0.0",
    "typescript-language-server": "^4.0.0",
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

`typescript-language-server` and `typescript` are pinned as **local** dependencies. The LSP client spawns `./node_modules/.bin/typescript-language-server --stdio`, avoiding reliance on global installs and ensuring reproducible behavior in CI and across machines.

---

## Testing Strategy

### Smoke Test (run from day 1)
Start the MCP server, send initialize → tools/list → ts_definition on a fixture file → verify response contains correct file path and line → shutdown. This single test catches: missing tsserver, framing bugs, protocol errors, path conversion issues.

### Tool Tests
Each tool tested against the `tests/fixtures/sample-project/` — a small TS project with known definitions, references, and types. Tests verify:
- Correct results for known symbols
- 1-indexed ↔ 0-indexed conversion
- Source preview content
- File path (not URI) in responses
- Unsaved buffer support (pass `content` parameter)
- File-not-found error handling

### Edge Cases
- Unicode content in files
- Multi-file projects with imports
- Symbols with multiple definitions (overloads)
- Non-existent file paths
- Invalid line/column positions
- Preview extraction returns in-memory content for dirty files, not stale disk content
- Workspace root discovery with nested `tsconfig.json` files
- Two tool calls targeting different workspace roots get separate LSP instances

---

## Open Questions — Resolved

| Question | Decision |
|----------|----------|
| Request cancellation? | Not needed for MVP — LSP requests are fast for single files |
| Max message size? | Trust OS pipe buffers. Revisit if large-codebase testing reveals issues |
| Message compression? | No — LSP doesn't support it, stdio doesn't benefit |
| Server topology? | One LSP instance per workspace root, lazily spawned. Root = nearest `tsconfig.json` ancestor. |
| Multi-file unsaved buffers? | MVP supports single-file `content` only. Multi-file sync deferred. |
| `vscode-languageclient` vs protocol/jsonrpc? | Use `vscode-languageserver-protocol` + `vscode-jsonrpc` only. `vscode-languageclient` requires VS Code extension host. |

---

## Timeline Estimate

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| Setup + LSP client | 1 day | Project scaffolding, LSP client with `vscode-languageserver-protocol` |
| Core tools | 1-2 days | `ts_definition`, `ts_references`, `ts_hover` with tests |
| MCP server integration | 1 day | MCP SDK setup, tool registration, smoke test passing |
| Polish + docs | 0.5 day | Error handling, README, config examples |
| **Milestone 1 Total** | **3-5 days** | **Core navigation MVP** |
| Symbol search | 1 day | `ts_symbols` tool |
| **Milestone 2 Total** | **1 day** | **Symbol search extension** |

---

## Verification Checklist

- [ ] `npm run build` compiles without errors
- [ ] Smoke test passes: initialize → tools/list → ts_definition → shutdown
- [ ] Each tool returns 1-indexed positions and file paths (not URIs)
- [ ] Each tool returns source preview lines
- [ ] Unsaved buffer content is correctly synced to LSP
- [ ] Server handles missing files gracefully (error, not crash)
- [ ] Server works with Claude Code MCP configuration
- [ ] Server works with Mistral Vibe MCP configuration
