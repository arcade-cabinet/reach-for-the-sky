---
title: Standards
updated: 2026-04-23
status: current
domain: quality
---

# Reach for the Sky — Standards

This document owns non-negotiable implementation and production standards. Testing specifics live in [docs/TESTING.md](./docs/TESTING.md). Product scope and remaining work live in [docs/PRODUCTION.md](./docs/PRODUCTION.md).

## Product Discipline

- The game is a modern living-tower simulator, not a retro homage product. Do not regress toward flat block-color placeholder presentation.
- The 2D cutaway is the primary interaction model. Optional sky/depth rendering cannot reduce gameplay readability.
- Architecture, people, reputation, and city pressure must remain coupled. Avoid feature work that isolates one layer and breaks the macro/meso/micro loop.
- Public-facing copy should describe a production game, never a POC, demo, prototype, or experiment.

## Code Quality

### TypeScript

- Strict TypeScript stays enabled.
- No casual `any`. If a boundary genuinely requires looseness, confine it and document why.
- Exported functions and public interfaces should have explicit types.
- Keep simulation code UI-free. `src/` systems must stay testable without Solid or Pixi rendering concerns leaking inward.

### File Structure

- `app/` owns Solid shell/UI composition.
- `src/` owns simulation, ECS/state, rendering adapters, persistence, audio, and diagnostics.
- `public/assets/vectors/` is the authored SVG source of truth for player-facing composite art.
- When a feature changes behavior materially, update the matching canonical doc in `docs/` in the same branch.

### Linting / Formatting

- Biome is the formatter/linter authority. Do not introduce ESLint or Prettier config.
- `pnpm lint` must pass before merge.

### Dependencies

- `pnpm` only. Do not add `package-lock.json` or `yarn.lock`.
- Preserve the current architecture choices unless there is an explicit product-level decision to change them: Solid, Pixi, raw Three optional, Koota, Yuka, Capacitor Preferences, Capacitor SQLite, Tone, Howler.
- Do not reintroduce React, React Three Fiber, Zustand, or Dexie.

## State / Persistence Discipline

- Koota traits/entities are the runtime source of truth.
- SQLite is the durable gameplay source of truth.
- Capacitor Preferences is for lightweight KV only: UI state, accessibility, diagnostics visibility, and similar granular settings.
- Save schema changes require migration coverage.

## Visual Standards

- Replace primitive placeholder shapes with authored SVG composites as systems harden.
- Favor restrained palettes, layered materials, and readable silhouettes over saturated primary blocks.
- Every lens must remain readable at a glance and useful on inspection.
- Visual review is not “it rendered”; it must verify hierarchy, clarity, tone, and touch/mobile fit.

## Git / Release Discipline

- Work on branches, open PRs, address review, squash merge to `main`.
- Keep `ci.yml`, `release.yml`, `cd.yml`, and `automerge.yml` healthy.
- Do not leave undocumented production debt hidden in code comments or chat history; track it in `docs/PRODUCTION.md` or the relevant domain doc.

## Required Checks

For substantial changes, run the full gate:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:browser
pnpm verify:release
pnpm capture:screenshots
```
