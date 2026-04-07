# TypeScript MCP Server — Plan

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the complete implementation plan.

## Quick Summary

MCP server bridging TypeScript LSP capabilities to AI agent tools.

**Stack:** TypeScript + `@modelcontextprotocol/sdk` + `vscode-languageserver-protocol`

**Milestone 1 — Core Navigation:**
- `ts_definition` — Go to definition
- `ts_references` — Find all references
- `ts_hover` — Get type/doc info

**Milestone 2 — Symbol Search:**
- `ts_symbols` — Search symbols in file or workspace

## Setup

```bash
npm install -g typescript typescript-language-server
npm install
npm run build
```
