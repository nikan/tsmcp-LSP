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

## Status

This repository is currently **doc-only** — implementation has not started. The setup instructions below describe the intended bootstrap sequence, not the current repo state.

## Bootstrap (when implementation begins)

```bash
# Initialize the project
npm init -y
npm install @modelcontextprotocol/sdk vscode-languageserver-protocol vscode-jsonrpc typescript-language-server typescript
npm install -D vitest @types/node

# Build and test
npm run build
npm test
```
