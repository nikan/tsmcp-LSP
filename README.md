# tsmcp-LSP

TypeScript MCP Language Server Protocol Bridge — exposes TypeScript semantic analysis as MCP tools for AI agents.

**Status:** Planning phase. See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for design and [Plan.md](Plan.md) for a quick summary. No implementation exists yet.

## Tools (planned)

| Tool | Description |
|------|-------------|
| `ts_definition` | Go to definition |
| `ts_references` | Find all references |
| `ts_hover` | Get type info and documentation |
| `ts_symbols` | Search symbols (Milestone 2) |

## Bootstrap (when implementation begins)

```bash
npm install
npm run build
npm test
```

All dependencies (including `typescript-language-server`) are local — no global installs required.
