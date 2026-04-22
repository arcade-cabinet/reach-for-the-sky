# Reach for the Sky

Standalone repository created from the Reach for the Sky arcade cabinet port on
2026-04-22.

The source material came from `/Users/jbogaty/src/jbcom/arcade-cabinet` during
the migration away from hosting standalone-scale games inside the central
arcade cabinet.

## Layout

- `app/games/reach-for-the-sky`: React/R3F game presentation, HUD, scene, and
  browser-start tests from the cabinet.
- `src/games/reach-for-the-sky`: tower-planning logic, state types, store
  traits, world state, and unit tests.
- `app/shared` and `src/shared`: the shared arcade UI hooks and pure utilities
  needed to understand imports that still use `@app/*` and `@logic/*`.
- `docs/games/reach-for-the-sky`: arcade cabinet notes and changelog.
- `references/poc`: provenance notes for pending POC recovery.

## Current State

This is a preservation import, not yet a polished standalone build. The next
agent should decide the target runtime, restore or create a standalone Vite or
Capacitor shell, and then promote mechanics and presentation deliberately.
