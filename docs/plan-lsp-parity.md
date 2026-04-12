# Plan: Bridge the Gap Between tsmcp-lsp and Internal LSP

**Date:** 2026-04-12
**Context:** Side-by-side comparison of the tsmcp-lsp MCP server against Claude Code's
built-in LSP tool revealed correctness gaps and missing operations.

---

## Gap Summary

| Area | Severity | Description |
|------|----------|-------------|
| ~~Go-to-definition resolves to import, not target~~ | ~~Critical~~ | ~~Fixed in PR #32~~ — `linkSupport: true` now enables proper definition resolution |
| Find-references misses files outside tsconfig scope | **High** | `ts_references` only finds references in files included by `tsconfig.json`; test files (excluded via `"exclude": ["tests"]`) are invisible |
| Missing LSP operations | **Medium** | 4 operations supported by internal LSP are not exposed: `goToImplementation`, `prepareCallHierarchy`, `incomingCalls`, `outgoingCalls` |

---

## Epic 1: Fix definition resolution (Critical) — DONE

> Resolved in PR #32 (merged to develop).

Set `linkSupport: true` in `lsp-client.ts` definition capability. The
`normalizeDefinitionResult` handler in `tools/definition.ts` already supported
`LocationLink[]`, so this was a one-line fix. Integration tests now verify that
`ts_definition` resolves through imports to actual declarations at import sites,
usage sites, and across multiple symbols.

---

## Epic 2: Broaden project scope for references (High)

### Root Cause

`tsconfig.json:17` excludes test files:

```json
"exclude": ["node_modules", "dist", "tests"]
```

The `WorkspaceManager.findRoot()` walks up to find `tsconfig.json` and uses that as the
workspace root. The LSP server then scopes its project to that tsconfig, making test files
invisible to `ts_references` and `ts_symbols`.

The internal LSP likely uses a broader project scope or a composite tsconfig strategy.

### Tasks

1. **Detect and use composite/multi-root tsconfig setup**: Check for `tsconfig.json` references
   array or look for sibling configs like `tsconfig.test.json`, `tsconfig.spec.json`. If found,
   consider using a root-level config that includes both source and test files.
2. **Alternative approach — open test files explicitly**: When the workspace root is determined,
   scan for additional tsconfigs (`tsconfig.*.json`) and register them as additional project
   roots with the language server.
3. **Consider using `workspaceFolders` more effectively**: The LSP `initialize` params already
   send `workspaceFolders`. Investigate whether `typescript-language-server` supports multiple
   project roots via workspace folders and whether we can add test directories as additional
   folders.
4. **Add integration test**: assert that `ts_references` on a symbol used in both `src/` and
   `tests/` returns references from both locations
5. **Add integration test**: assert that `ts_symbols` with workspace scope finds symbols in
   test files

---

## Epic 3: Add missing LSP operations (Medium)

### Gap

The internal LSP supports 4 operations not exposed by tsmcp-lsp:

| Operation | Description | LSP Method |
|-----------|-------------|------------|
| `goToImplementation` | Find implementations of an interface/abstract method | `textDocument/implementation` |
| `prepareCallHierarchy` | Get the call hierarchy item at a position | `textDocument/prepareCallHierarchy` |
| `incomingCalls` | Find all callers of a function | `callHierarchy/incomingCalls` |
| `outgoingCalls` | Find all callees from a function | `callHierarchy/outgoingCalls` |

### Tasks

1. **Add `implementation` method to `LspClient`**: Register the `ImplementationRequest` type,
   declare `implementationProvider` capability, add `implementation()` method
2. **Register `ts_implementation` MCP tool**: New file `src/tools/implementation.ts`, same
   pattern as `ts_definition` with `normalizeDefinitionResult` reuse
3. **Add call hierarchy methods to `LspClient`**: Register `PrepareCallHierarchyRequest`,
   `CallHierarchyIncomingCallsRequest`, `CallHierarchyOutgoingCallsRequest`; declare
   `callHierarchyProvider` capability; add `prepareCallHierarchy()`, `incomingCalls()`,
   `outgoingCalls()` methods
4. **Register `ts_call_hierarchy` MCP tool**: New file `src/tools/call-hierarchy.ts` with
   a `mode` parameter (`prepare`, `incoming`, `outgoing`) to keep it as one tool
5. **Add integration tests** for all 4 new operations using the sample project fixture
6. **Register new tools in `src/index.ts`**

---

## Implementation Order

1. **Epic 1** (definition fix) — smallest change, highest impact, unblocks trust in the tool
2. **Epic 3** (new operations) — additive, no risk to existing functionality
3. **Epic 2** (broader scope) — most complex, may require workspace manager redesign

---

## Success Criteria

When complete, running the same 4-operation comparison test should produce:
- ~~`ts_definition` resolves through imports to actual definitions (matching internal LSP)~~ — **done**
- `ts_references` finds references across source and test files (matching internal LSP)
- `ts_hover` continues to match (already at parity)
- `ts_symbols` finds symbols in test files (matching internal LSP)
- New operations (`ts_implementation`, `ts_call_hierarchy`) produce results consistent with
  internal LSP equivalents
