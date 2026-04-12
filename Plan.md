# TypeScript MCP Server — Plan

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the complete implementation plan.

## Quick Summary

MCP server bridging TypeScript LSP capabilities to AI agent tools.

**Stack:** TypeScript + `@modelcontextprotocol/sdk` + `vscode-languageserver-protocol` + `vscode-jsonrpc`

**Milestone 1 — Core Navigation:**
- `ts_definition` — Go to definition
- `ts_references` — Find all references
- `ts_hover` — Get type/doc info

**Milestone 2 — Symbol Search:**
- `ts_symbols` — Search symbols in file or workspace

**Milestone 3 — LSP Parity:**
- `ts_implementation` — Go to implementation (interfaces/abstract classes)
- `ts_call_hierarchy` — Find incoming callers or outgoing callees

## Status

All milestones complete. 6 MCP tools fully functional.

## Setup

```bash
npm install
npm run build
npm test
```
