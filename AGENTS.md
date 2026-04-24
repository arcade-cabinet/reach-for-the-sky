---
title: Agent Guide
updated: 2026-04-24
status: current
domain: context
---

# Reach for the Sky Agent Guide

This repository is the standalone home for Reach for the Sky.

## What The Game Is

Reach for the Sky is a modern living-tower simulator where architecture, people, reputation, and city pressure collide. The product is simulation-first: readable 2D cutaway tower management with cinematic support, not a nostalgia clone and not a 3D-first building toy.

## Repository Shape

- `app/`: Solid UI shell, HUD, drawers, and canvas host
- `src/`: pure simulation, state, rendering, persistence, audio, diagnostics
- `public/`: static assets, vectors, previews, icons, audio, SQL WASM
- `docs/`: canonical product, technical, and production docs
- `scripts/`: browser verifiers and build helpers
- `tests/`: unit test coverage

Path aliases:

```text
@app/*   -> app/*
@logic/* -> src/*
@/*      -> src/* (legacy/internal compatibility; prefer @logic for src imports where practical)
```

## Working Rules

1. Preserve the simulation-first identity. Readability beats spectacle.
2. Do not reintroduce React, R3F, Zustand, or Dexie.
3. Prefer authored SVG/vector composition over placeholder geometry for player-facing visuals.
4. Keep SQLite as durable truth and Preferences as lightweight KV only.
5. Do not describe the game to players as a prototype, POC, or demo.
6. When changing systems, update the relevant file in `docs/` in the same branch.

## Canonical Docs

- `docs/DESIGN.md`: identity and player journey
- `docs/SYSTEMS.md`: gameplay/system domains
- `docs/CONTENT.md`: room/cohort/act content accounting
- `docs/ARCHITECTURE.md`: runtime and deployment architecture
- `docs/UI_UX.md`: shell layout and explanation surfaces
- `docs/VISUAL_REVIEW.md`: visual direction and art debt
- `docs/TESTING.md`: verification lanes
- `docs/PRODUCTION.md`: remaining work and readiness
- `docs/RELEASE.md`: shipping flow
- `docs/STATE.md`: current merged state
- `STANDARDS.md`: non-negotiable implementation and production constraints

## Minimum Checks

Run the relevant subset before committing. For broad product changes, run all of them.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:browser
pnpm capture:screenshots
```

## Immediate Priorities

1. Expand authored content breadth without compromising readability.
2. Keep the docs surface accurate as the product evolves.
3. Preserve the PR -> review -> squash merge -> main CD discipline.
