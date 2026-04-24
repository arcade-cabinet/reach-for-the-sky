---
title: Agentic Handoff Folder
updated: 2026-04-24
status: current
domain: context
---

# docs/agentic

Handoff documents for work that was scoped, sized, and triaged in one
session but intentionally deferred to another agent (future session or
remote runner). Each file under this folder is a self-contained brief —
new reader should be able to pick it up without reading chat history.

## Ownership

The agent opening a handoff doc should:

1. Read the brief top-to-bottom; don't skim.
2. Verify the current state of the code matches the "State at handoff"
   section — things may have changed since the doc was written.
3. Work through the "Tasks" list; mark each one done as it lands.
4. Close the loop when empty: delete the file, or mark
   `status: archived` in the frontmatter and move it to
   `docs/agentic/archive/`.

## Current handoffs

| File | Subject |
|------|---------|
| `pr-122-followups.md` | Deferred items from the PR #122 (test/vitest-browser-mode) review + memory audit. |
