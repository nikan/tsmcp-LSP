# tsmcp-LSP

TypeScript MCP Language Server Protocol Bridge — exposes TypeScript semantic analysis as MCP tools for AI agents.

**Status:** MVP complete. `ts_definition`, `ts_references`, `ts_hover`, and `ts_symbols` are registered as MCP tools and fully functional.

## Architecture

```
Agent <-> [stdio/MCP SDK] <-> MCP Server <-> LSP Client <-> [stdio] <-> typescript-language-server
```

- **LSP Client** — spawns `typescript-language-server --stdio`, communicates via `vscode-jsonrpc`
- **Workspace Manager** — maps file paths to workspace roots (nearest `tsconfig.json`/`jsconfig.json`), one LSP instance per root
- **Document Manager** — tracks open/change lifecycle, in-memory content for dirty files
- **Utilities** — URI/path conversion, 1-indexed position mapping, preview line extraction

## Tools

| Tool | Description | Status |
|------|-------------|--------|
| `ts_definition` | Go to definition | Implemented |
| `ts_references` | Find all references | Implemented |
| `ts_hover` | Get type info and documentation | Implemented |
| `ts_symbols` | Search symbols (file or workspace scope) | Implemented |

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
  index.ts              # MCP server entry point
  lsp-client.ts         # LSP client transport
  workspace-manager.ts  # Per-root LSP instance management
  document-manager.ts   # Document open/change lifecycle
  utils.ts              # Path, URI, position, preview helpers
  tools/
    definition.ts       # ts_definition MCP tool
    references.ts       # ts_references MCP tool
    hover.ts            # ts_hover MCP tool
    symbols.ts          # ts_symbols MCP tool
tests/
  lsp-client.test.ts
  workspace-manager.test.ts
  document-manager.test.ts
  utils.test.ts
  smoke.test.ts         # End-to-end MCP tool tests
  fixtures/
    sample-project/     # Test fixture with tsconfig + TS sources
```

## MCP Configuration

### Claude Code

Add to `~/.claude/settings.json` or your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "tsmcp-lsp": {
      "command": "node",
      "args": ["/path/to/tsmcp-LSP/dist/index.js"]
    }
  }
}
```

### Generic MCP client (stdio transport)

```bash
node /path/to/tsmcp-LSP/dist/index.js
```

The server communicates over stdio using the MCP protocol. Any MCP-compatible client can connect by spawning the process and exchanging JSON-RPC messages on stdin/stdout.

## Design

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for full architecture details and tool contracts.
