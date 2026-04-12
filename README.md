# tsmcp-LSP

TypeScript MCP Language Server Protocol Bridge — exposes TypeScript semantic analysis as MCP tools for AI agents.

**Status:** 6 MCP tools registered and fully functional: `ts_definition`, `ts_references`, `ts_hover`, `ts_symbols`, `ts_implementation`, and `ts_call_hierarchy`.

## Architecture

```
Agent <-> [stdio/MCP SDK] <-> MCP Server <-> LSP Client <-> [stdio] <-> typescript-language-server
```

- **LSP Client** — spawns `typescript-language-server --stdio`, communicates via `vscode-jsonrpc`
- **Workspace Manager** — maps file paths to workspace roots (nearest `tsconfig.json`/`jsconfig.json`), one LSP instance per root
- **Document Manager** — tracks open/change lifecycle, in-memory content for dirty files
- **Utilities** — URI/path conversion, 1-indexed position mapping, preview line extraction

## Tools

| Tool | Description |
|------|-------------|
| `ts_definition` | Go to definition of a symbol |
| `ts_references` | Find all references of a symbol |
| `ts_hover` | Get type info and documentation |
| `ts_symbols` | Search symbols (file or workspace scope) |
| `ts_implementation` | Find concrete implementations of interfaces/abstract classes |
| `ts_call_hierarchy` | Find incoming callers or outgoing callees of a function |

All position-based tools accept **1-indexed** `line` and `column` parameters (matching what editors display). The server converts to 0-indexed internally for LSP.

## Installation

```bash
git clone https://github.com/nikan/tsmcp-LSP.git
cd tsmcp-LSP
npm install
npm run build
```

All dependencies (including `typescript-language-server` and `typescript`) are local — no global installs required.

Verify the build:

```bash
npm test
```

After building, the server entry point is `dist/index.js`. Use the **absolute path** to this file when configuring clients below.

## Client Configuration

The server runs over **stdio** — each client spawns it as a child process and communicates via MCP (JSON-RPC on stdin/stdout). Replace `/path/to/tsmcp-LSP` with your actual install path.

### Claude Code

Add to your project's `.mcp.json` (or `~/.claude/settings.json` for global access):

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

Or register via the CLI:

```bash
claude mcp add tsmcp-lsp -- node /path/to/tsmcp-LSP/dist/index.js
```

### OpenAI Codex

Register with the Codex CLI:

```bash
codex mcp add tsmcp-lsp -- node /path/to/tsmcp-LSP/dist/index.js
```

Verify it was added:

```bash
codex mcp list
```

### GitHub Copilot (VS Code)

Add to your project's `.vscode/mcp.json`:

```json
{
  "servers": {
    "tsmcp-lsp": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/tsmcp-LSP/dist/index.js"]
    }
  }
}
```

### Mistral Vibe

Add the following to `~/.vibe/config.toml`:

```toml
[[mcp_servers]]
name = "tsmcp-lsp"
transport = "stdio"
command = "node"
args = ["/path/to/tsmcp-LSP/dist/index.js"]
startup_timeout_sec = 20
tool_timeout_sec = 120
```

### Generic MCP client

Spawn the server directly and exchange MCP messages on stdin/stdout:

```bash
node /path/to/tsmcp-LSP/dist/index.js
```

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
    implementation.ts   # ts_implementation MCP tool
    call-hierarchy.ts   # ts_call_hierarchy MCP tool
tests/
  lsp-client.test.ts
  workspace-manager.test.ts
  document-manager.test.ts
  utils.test.ts
  smoke.test.ts         # End-to-end MCP tool tests
  fixtures/
    sample-project/     # Test fixture with tsconfig + TS sources
```

## Design

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for full architecture details and tool contracts.
