content = r'''# TypeScript Semantics via MCP — MCP Plan (for Claude Code CLI + Mistral Vibe)

## Goal

Provide **TypeScript semantic capabilities** (go-to-definition, find references, hover/type info, rename, diagnostics, symbols) to **both**:

- **Claude Code CLI**
- **Mistral Vibe CLI**

…using a shared **MCP server** that wraps **TypeScript’s LSP stack**.

## Why this approach

- **LSP is the semantic engine**: it provides code intelligence features like “go to definition”, “find references”, “hover”, diagnostics, etc. via a standardized protocol.
- **TypeScript’s native semantic engine is** `tsserver`, which speaks a TypeScript-specific protocol, not LSP.
- `typescript-language-server` **(TSLS)** provides a thin **LSP interface** that translates LSP requests into `tsserver` commands and back.
- **MCP is the tool-sharing layer** for agents; we expose semantic functions as MCP tools so multiple agent clients can call them.

---

## Architecture

### Components

1. **TypeScript language server**: `typescript-language-server --stdio` + `typescript` runtime
2. **MCP “TS Semantics” server** (your bridge): 
    - Spawns and manages TSLS process
    - Implements minimal LSP client (JSON-RPC over stdio)
    - Exposes semantic operations as MCP tools
3. **MCP clients**: 
    - Claude Code CLI (configured to launch the MCP server)
    - Mistral Vibe (configured via `~/.vibe/config.toml` `[[mcp_servers]]`)

### Data flow

1. Agent requests semantic action (e.g., “find references of Foo”).
2. Agent calls MCP tool `ts_references`.
3. MCP server calls corresponding LSP method `textDocument/references` to TSLS.
4. TSLS forwards to `tsserver`, returns results.
5. MCP server returns structured results to the agent.

---

## Semantic tool surface (MVP)

Expose **6 MCP tools** (enough for 90% of refactors and navigation):

1. `ts_definition` → LSP `textDocument/definition`
2. `ts_references` → LSP `textDocument/references`
3. `ts_hover` → LSP `textDocument/hover`
4. `ts_rename` → LSP `textDocument/rename`
5. `ts_diagnostics` → LSP diagnostics (from `textDocument/publishDiagnostics` stream)
6. `ts_symbols` → LSP `workspace/symbol` and/or `textDocument/documentSymbol`

**Optional later** (nice to have): call hierarchy, implementations, code actions, formatting.

---

## Installation prerequisites

### 1) Install the TypeScript language server

Install globally (simple) or per-project (recommended for version parity).

**Global:**

```Shell
npm install -g typescript typescript-language-server
