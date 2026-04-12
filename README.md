# tsmcp-LSP

TypeScript MCP Language Server Protocol Bridge — exposes TypeScript semantic analysis as MCP tools for AI agents.

**Status:** Foundation implemented. LSP runtime, workspace management, document sync, and shared utilities are in place. MCP tool registration is next.

## Architecture

```
Agent <-> [stdio/MCP SDK] <-> MCP Server <-> LSP Client <-> [stdio] <-> typescript-language-server
```

- **LSP Client** — spawns `typescript-language-server --stdio`, communicates via `vscode-jsonrpc`
- **Workspace Manager** — maps file paths to workspace roots (nearest `tsconfig.json`/`jsconfig.json`), one LSP instance per root
- **Document Manager** — tracks open/change lifecycle, in-memory content for dirty files
- **Utilities** — URI/path conversion, 1-indexed position mapping, preview line extraction

## Tools (planned)

| Tool | Description | Status |
|------|-------------|--------|
| `ts_definition` | Go to definition | Runtime ready |
| `ts_references` | Find all references | Runtime ready |
| `ts_hover` | Get type info and documentation | Runtime ready |
| `ts_symbols` | Search symbols (Milestone 2) | Runtime ready |

## Setup

```bash
npm install
npm run build
npm test
```

All dependencies (including `typescript-language-server` and `typescript`) are local — no global installs required.

## Project Structure

```
src/
  index.ts              # MCP server entry point (stub)
  lsp-client.ts         # LSP client transport
  workspace-manager.ts  # Per-root LSP instance management
  document-manager.ts   # Document open/change lifecycle
  utils.ts              # Path, URI, position, preview helpers
tests/
  lsp-client.test.ts
  workspace-manager.test.ts
  document-manager.test.ts
  utils.test.ts
  fixtures/
    sample-project/     # Test fixture with tsconfig + TS sources
```

## Design

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for full architecture details and tool contracts.
