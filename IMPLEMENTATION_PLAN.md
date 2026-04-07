# MCP Server for TypeScript LSP — Implementation Plan

## Overview

An MCP server that exposes TypeScript semantic analysis (go-to-definition, find-references, hover, symbol search) as tools for AI agents like Claude Code and Mistral Vibe.

**Key decisions:**
- **Language:** TypeScript (single Node.js runtime, aligns with target ecosystem)
- **MCP layer:** `@modelcontextprotocol/sdk` (no hand-rolled JSON-RPC)
- **LSP client:** `vscode-languageclient` / `vscode-languageserver-protocol` (no custom message framing)
- **LSP backend:** `typescript-language-server` (wraps `tsserver`)
- **Transport:** stdio

---

## Project Structure

```
tsmcp-lsp/
├── src/
│   ├── index.ts              # Entry point — MCP server setup
│   ├── lsp-client.ts         # LSP client using vscode-languageclient
│   ├── document-manager.ts   # Document open/change/close lifecycle
│   ├── tools/
│   │   ├── definition.ts     # ts_definition tool
│   │   ├── references.ts     # ts_references tool
│   │   ├── hover.ts          # ts_hover tool
│   │   └── symbols.ts        # ts_symbols tool (Milestone 2)
│   └── utils.ts              # URI↔path conversion, preview extraction
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
- `content` (optional): Current file content for unsaved buffers

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
  "file_path": "/project/src/utils.ts (optional — omit for workspace search)"
}
```

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

Uses `vscode-languageserver-protocol` and Node.js child process to communicate with `typescript-language-server --stdio`. Handles:
- Spawning and managing the `typescript-language-server` process
- LSP initialize handshake
- Sending requests (`textDocument/definition`, `textDocument/references`, `textDocument/hover`, `workspace/symbol`, `textDocument/documentSymbol`)
- Receiving responses with proper request/response ID matching
- Graceful shutdown

### Document Manager (`src/document-manager.ts`)

Tracks which files are open in the LSP server and their versions. Implements "open-if-missing, update-if-exists" semantics:

1. Tool receives `file_path` + optional `content`
2. If document not open → send `textDocument/didOpen` with content (read from disk if not provided)
3. If document open and `content` differs → send `textDocument/didChange` with new content
4. If document open and no `content` → use existing state

State machine: `CLOSED → didOpen → OPEN → didChange → DIRTY → didClose → CLOSED`

### Response Enrichment (`src/utils.ts`)

- Convert `file://` URIs to absolute file paths in all responses
- Convert 0-indexed LSP positions to 1-indexed in responses
- Extract source preview lines from files at returned locations
- Helper: `uriToPath()`, `pathToUri()`, `getPreviewLine()`

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
    "vscode-jsonrpc": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

**Runtime prerequisite:** `typescript-language-server` installed globally (`npm install -g typescript typescript-language-server`).

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

---

## Open Questions — Resolved

| Question | Decision |
|----------|----------|
| Request cancellation? | Not needed for MVP — LSP requests are fast for single files |
| Max message size? | Trust OS pipe buffers. Revisit if large-codebase testing reveals issues |
| Message compression? | No — LSP doesn't support it, stdio doesn't benefit |

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
