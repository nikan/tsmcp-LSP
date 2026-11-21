# tsmcp-LSP — instructions for coding agents (Codex, Claude)

Project specifics live in `CLAUDE.md`; this file holds what every agent, including Codex on GitHub, must follow.
The organisation-wide rules are in the dev-standards handbook.

## Working rules

- Pull requests target `main` (the default branch; releases are `vX.Y.Z` tags on it).
- Conventional Commits: `type(scope): what is now true for the user` (header ≤ 120 chars).
- Checks: `sh scripts/dev check` (lint, arch, typecheck, coverage, i18n, unused, build).
- This is an MCP stdio server: only protocol messages on stdout; log with `console.error`.
- Never reformat `tests/fixtures/`: the tests assert exact line and column positions in it.
- Before handing off, run the narrowest relevant tests and type checks, then broaden.

<!-- dev-standards:codex-review:begin v1 -->
<!-- Maintained by dev-standards (/agents-md). Edit only the project block below; the rules come from handbook/08. -->

## Code Review Rules

These rules apply when Codex reviews a pull request on GitHub (automatically or on `@codex review`).

Report findings only; the approval is given by the project's reviewer account once a round on the head commit
has no findings.

**At most three rounds, unless the finding is high impact.**

- A round is one review of a new push to the same pull request. Count your own earlier reviews on it: the reviews by
  `chatgpt-codex-connector` on this pull request that start with **Codex Review** (each names its `Reviewed commit`).
  The review you are writing is that number plus one. If you cannot see them, count the pushes to the pull request since
  it was opened, the opening counting as one.
- In rounds 1 to 3, review normally.
- From round 4 on, report **only high-impact findings** (below). If there are none, report no findings and write
  `Review limit reached (3 rounds): no high-impact findings.`
- Do not use a later round to look for new low-impact details in code you already reviewed. In each round, check that the
  fixes for your earlier findings are correct and that the new changes are sound.
- Do not repeat a finding the author has answered in its thread with a reason, unless the reason is wrong.

**High impact means:**

- a security problem: authentication or authorisation bypass, injection, leaked secrets, unsafe handling of untrusted
  input, SSRF, missing rate limiting on a public write endpoint;
- data loss or corruption, a migration that fails, is not additive, or cannot be undone, or handling of personal data
  that contradicts the privacy page;
- a bug that breaks one of this project's main flows, or deployment, for most users;
- breaking one of this project's red lines.

<!-- dev-standards:project:begin -->

This project's main flows: an MCP client (Claude Code, other agents) starting the server over stdio and calling its six tools — `ts_definition`, `ts_references`, `ts_hover`, `ts_symbols`, `ts_implementation`, `ts_call_hierarchy` — on a TypeScript/JavaScript workspace; one `typescript-language-server` per workspace root, started on first use.
This project's red lines: nothing but MCP JSON-RPC on stdout (logs go to stderr; a stray `console.log` breaks every client); the server is read-only and never writes, renames or deletes files in the user's workspace; tool `line`/`column` are 1-indexed in and out (0-indexed only towards LSP); spawned language servers are shut down with the server (no orphan processes); paths and URIs keep working on Linux, macOS and Windows; the bundled `typescript` and `typescript-language-server` stay runtime dependencies.
Deliberate trade-offs are recorded in: `IMPLEMENTATION_PLAN.md`, `docs/` (e.g. `docs/plan-lsp-parity.md`), the "Known Limits" section of `README.md`, and "Exceptions to the standard" in `CLAUDE.md`.
<!-- dev-standards:project:end -->

**What to look at, in this order:** correctness against the PR description and plan; security; data and migrations;
the layering rules and naming of the dev-standards handbook; tests that would fail without the change; i18n and
accessibility of new UI; performance only where it is visible at this project's scale.

Everything else (style, naming, wording, small edge cases at this scale, test tidiness, theoretical races) is lower
impact: mention it as P2 or P3 in rounds 1 to 3 only. Do not raise again a deliberate trade-off recorded in the places
named above.
<!-- dev-standards:codex-review:end -->
