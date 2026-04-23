---
title: Agent Instructions
updated: 2026-04-23
status: current
---

# Reach for the Sky — Agent Instructions

## What This Is

Reach for the Sky is a production-bound living-tower simulator built as a standalone Solid + Pixi + Koota + Yuka + Capacitor application. The game is about architecture, people, reputation, and city pressure colliding inside a readable 2D cutaway tower.

## Canonical Doc Ownership

- `docs/DESIGN.md` — identity, pillars, macro/meso/micro, five-act journey
- `docs/SYSTEMS.md` — gameplay/system ownership and current implementation state
- `docs/CONTENT.md` — room families, cohorts, lenses, scenario breadth, act content status
- `docs/ARCHITECTURE.md` — runtime stack, rendering, persistence, CI/CD architecture
- `docs/UI_UX.md` — HUD, drawers, inspection, mobile/touch expectations
- `docs/VISUAL_REVIEW.md` — visual quality bar and remaining art debt
- `docs/TESTING.md` — automated/manual verification matrix
- `docs/PRODUCTION.md` — explicit remaining work and next milestones
- `docs/RELEASE.md` — release/runbook expectations
- `docs/STATE.md` — current merged state and recent progression
- `STANDARDS.md` — non-negotiable implementation and production constraints

## Critical Rules

1. Keep the product simulation-first. Spectacle supports the cutaway; it does not replace it.
2. Do not frame the game as a POC, prototype, or demo in product-facing copy.
3. Do not reintroduce React, R3F, Zustand, or Dexie.
4. Keep Koota as runtime state, SQLite as durable truth, and Preferences as lightweight KV only.
5. Prefer authored SVG composition over crude placeholder geometry in all player-facing surfaces.
6. When behavior or scope changes, update the relevant doc in `docs/` in the same branch.
7. Preserve PR review discipline: branch, PR, feedback, squash merge, verify `main`.

## Commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:browser
pnpm verify:release
pnpm capture:screenshots
pnpm cap:sync:android
```

## Immediate Priorities

- Continue expanding authored content breadth and room/cohort differentiation.
- Keep the documentation surface accurate enough that remaining work is obvious without chat archaeology.
- Preserve production readiness for Web + Android while clarifying the iOS/store-submission gap.
