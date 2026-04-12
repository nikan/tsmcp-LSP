# Plan: Bridge the Gap Between tsmcp-lsp and Internal LSP

**Date:** 2026-04-12
**Context:** Side-by-side comparison of the tsmcp-lsp MCP server against Claude Code's
built-in LSP tool revealed correctness gaps and missing operations.

---

## Gap Summary

| Area | Severity | Description |
|------|----------|-------------|
| ~~Go-to-definition resolves to import, not target~~ | ~~Critical~~ | ~~Fixed in PR #32~~ — `linkSupport: true` now enables proper definition resolution |
| ~~Find-references misses files outside tsconfig scope~~ | ~~High~~ | ~~Fixed in PR #34~~ — `WorkspaceManager` now opens all workspace files via `didOpen` at startup |
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

## Epic 2: Broaden project scope for references (High) — DONE

> Resolved in PR #34 (merged to develop).

`WorkspaceManager` now accepts a `DocumentManager` at construction and runs
`broadenScope()` after each `LspClient.start()`. This recursively discovers all
`.ts`/`.tsx`/`.js`/`.jsx` files in the workspace root (skipping `node_modules`,
`dist`, `.git`, and `.d.ts` files) and opens them via `didOpen`. tsserver creates
inferred projects for files outside the tsconfig scope, making cross-file
references and workspace symbols work across source and test files.

Safety: a 1000-file cap prevents startup cost explosion on monorepos. The
`broadened` set is cleared on `shutdownAll()` and stale-client removal so
re-broadening runs correctly after LSP restarts.

Integration tests verify: cross-scope `ts_references` for both `greet` and `add`,
workspace symbols finding test-file variables, document symbols on test files,
and no regression on source-only references (5 new tests).

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

1. ~~**Epic 1** (definition fix) — smallest change, highest impact, unblocks trust in the tool~~ — **done** (PR #32)
2. ~~**Epic 2** (broader scope) — workspace manager broadenScope via didOpen~~ — **done** (PR #34)
3. **Epic 3** (new operations) — additive, no risk to existing functionality

---

## Success Criteria

When complete, running the same 4-operation comparison test should produce:
- ~~`ts_definition` resolves through imports to actual definitions (matching internal LSP)~~ — **done**
- ~~`ts_references` finds references across source and test files (matching internal LSP)~~ — **done**
- `ts_hover` continues to match (already at parity)
- ~~`ts_symbols` finds symbols in test files (matching internal LSP)~~ — **done**
- New operations (`ts_implementation`, `ts_call_hierarchy`) produce results consistent with
  internal LSP equivalents
