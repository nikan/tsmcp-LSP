# tsmcp-LSP

Follows the global dev-standards (`~/.claude/CLAUDE.md` + dev-standards plugin).
This file holds only what is specific to this project.

## What it is

An MCP server over stdio that exposes TypeScript semantic analysis (definition, references, hover, symbols,
implementation, call hierarchy) to AI agents by driving `typescript-language-server` as an LSP client.

## Type and stack

- Type: `mcp-stdio` (handbook/06 — released by tag, never deployed).
- Language pack: `node`. Single package (no workspaces); `@modelcontextprotocol/sdk`, `vscode-languageserver-protocol`,
  and a bundled `typescript` + `typescript-language-server` (runtime dependencies, not dev ones).
- UI design context: none (no UI).

## Layout

- `src/index.ts` — MCP server entry (stdio); `src/tools/` — one file per MCP tool
- `src/lsp-client.ts`, `src/workspace-manager.ts`, `src/document-manager.ts`, `src/utils.ts` — LSP plumbing
- `tests/` — Vitest; `tests/fixtures/sample-project/` is a TypeScript project the tests analyse (positions matter:
  never reformat it)

## Commands

The same in every project (handbook/05): `sh scripts/dev <command>` —
`setup`, `lint`, `format`, `typecheck`, `arch`, `test`, `coverage`, `i18n`, `unused`, `build`, `check` (all), `ci`.
Project-specific:

- Run: `npm run build && node dist/index.js` (normally started by the MCP client).
- Tests build first (`pretest`, `pretest:coverage`): the smoke test starts `dist/index.js`.
- DB tests / e2e / migrations: none.

## Locales

Source: none. Others: none. (No user-facing UI text; tool descriptions are English API text for agents.)

## Release (types other than service)

- Published to: GitHub releases only (`release.yml` has no npm step; `package.json` is `private`).
- How users install it: from source — `git clone`, `npm install`, `npm run build`, then
  `claude mcp add tsmcp-lsp -- node /path/to/tsmcp-LSP/dist/index.js` (README).

## Review & merge (handbook/08)

- Codex reviews every PR into the default branch (`main`); its rules are in `AGENTS.md`.
- Merge: merge-on-approval — `nikobotaki` approves the head commit (`/address-review` runs `approve-pr.mjs`) and the
  workflow squash-merges. Claude may approve without asking: no.

## Exceptions to the standard

- File names are kebab-case (`lsp-client.ts`), predating the camelCase rule; renaming is a separate change.
- `src/` is flat, not layered (domain / application / infrastructure / presentation): a small adapter between two
  protocols. `sh scripts/dev arch` therefore only enforces `no-circular` today.
- `engines.node` stays `>=18` for users (README); CI and development use Node 22 (`.nvmrc`).
- Own `tsconfig.json` (Node16 ESM, emitted and run directly by Node) instead of the pack's `tsconfig.base.json`,
  whose `Bundler` resolution and stricter flags don't fit yet.
- No i18n: `sh scripts/dev i18n` finds no locales and skips.
