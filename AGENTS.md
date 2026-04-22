# Reach for the Sky Agent Guide

This repository was created on 2026-04-22 to preserve the Reach for the Sky
implementation removed from `/Users/jbogaty/src/jbcom/arcade-cabinet`.

## Provenance

- Source: arcade cabinet single-app React/Vite/Capacitor migration.
- Original arcade paths: `app/games/reach-for-the-sky`,
  `src/games/reach-for-the-sky`, and `docs/games/reach-for-the-sky`.
- No standalone pending HTML POC for Reach for the Sky was found in the arcade
  cabinet git history. The available provenance is the arcade port and its docs.

## Architecture Intent

Keep the split between presentation and logic:

- `app/`: React components, R3F scenes, HUDs, responsive layout, styles, and
  browser-focused tests.
- `src/`: pure game logic, tower planning, scoring, world state, traits, math,
  and unit-testable systems.
- `public/`: future shared assets, wasm, generated previews, icons, and static
  files if a standalone app shell is added.

The imported files still use the arcade aliases:

```text
@app/*   -> app/*
@logic/* -> src/*
```

If a standalone Vite shell is added, configure these aliases rather than
rewriting imports ad hoc.

## Evaluation Priorities

1. Rebuild the standalone runtime deliberately instead of copying cabinet shell
   code without review.
2. Preserve pure tower-planning tests before changing visuals.
3. Decide the core pillars: vertical construction, resource pressure, readable
   tower silhouette, weather/height risk, and satisfying touch interaction.
4. Design mobile and desktop controls around the game, not around the old
   cabinet D-pad assumptions.
5. Verify every visual claim with browser screenshots after a dev server render.

## Required Checks After Build Tooling Exists

Run the relevant equivalents before committing:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If browser/e2e coverage is restored, capture desktop and mobile screenshots and
keep the test harness committed.
