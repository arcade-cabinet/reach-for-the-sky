---
title: Architecture
updated: 2026-04-23
status: current
domain: technical
---

# Reach for the Sky — Architecture

This document owns the runtime stack, directory structure, data flow, and deployment architecture. Game identity lives in [DESIGN.md](./DESIGN.md). Remaining production work lives in [PRODUCTION.md](./PRODUCTION.md). Verification coverage lives in [TESTING.md](./TESTING.md).

## System Overview

```text
┌──────────────────────────────────────────────────────────────┐
│ Solid UI shell                                               │
│ Top HUD, left/right drawers, settings, contracts, reports    │
├──────────────────────────────────────────────────────────────┤
│ Koota trait state                                            │
│ Campaign, tower, macro, operations, clock, settings, view    │
├──────────────────────────────────────────────────────────────┤
│ Pure simulation                                              │
│ Placement, tick, visitors, contracts, reports, public memory │
├──────────────────────────────────────────────────────────────┤
│ Rendering                                                    │
│ Pixi cutaway + optional Three sky/depth                      │
├──────────────────────────────────────────────────────────────┤
│ Persistence                                                  │
│ SQLite durable saves/events + Preferences lightweight KV     │
├──────────────────────────────────────────────────────────────┤
│ Audio                                                        │
│ Tone procedural cues + Howler OGG sprite playback            │
└──────────────────────────────────────────────────────────────┘
```

## Runtime Stack

- `pnpm`, Vite, TypeScript, Biome, Vitest
- SolidJS app shell via `vite-plugin-solid`
- PixiJS v8 for the main tower renderer
- raw Three.js for optional skyline and sky-depth composition
- Koota for runtime state traits/entities
- Yuka for routing and personality-driven simulation planning
- Capacitor 8 app shell
- `@capacitor-community/sqlite` + `jeep-sqlite` + `sql.js` for durable saves
  - Web fallback constraint: `pnpm build` must copy `sql.js/dist/sql-wasm.wasm` to `public/assets/sql-wasm.wasm`. The browser/`jeep-sqlite` path expects that asset at runtime, so removing the copy step breaks web SQLite even if native builds still work. `sql.js` is intentionally pinned to `1.11.0`; do not relax that pin without re-validating the wasm loading path end to end.
- `@capacitor/preferences` for UI/settings KV state
- Tone.js for procedural audio cues
- Howler.js for sourced OGG sprite playback

## Directory Structure

```text
app/
  App.tsx                         # shell orchestration
  components/                     # Solid UI components and canvas host
  styles/                         # tokens, global styles, HUD/layout styling

src/
  audio/                          # Tone/Howler runtime
  diagnostics/                    # exportable debug bundle generation
  persistence/                    # SQLite repositories + Preferences adapters
  platform/                       # native shell integration
  rendering/                      # Pixi/Three render systems and vector composition
  simulation/                     # pure game rules and campaign systems
  state/                          # Koota traits, world, and actions

public/
  assets/audio/                   # OGG cue sprites
  assets/icons/                   # manifest/launcher assets
  assets/previews/                # committed screenshots/previews
  assets/sql-wasm.wasm            # web SQLite runtime
  assets/vectors/                 # authored SVG tower/room/agent elements

docs/                             # canonical product, technical, and release docs
scripts/                          # browser verifiers, screenshot capture, build helpers
tests/                            # unit tests and simulation coverage
android/                          # Capacitor Android shell
```

## State Boundaries

- Koota traits are the source of runtime truth.
- `src/simulation/` stays framework-free and deterministic.
- `src/state/actions.ts` is the bridge between UI input and pure simulation.
- SQLite stores durable truth: save slots and simulation event history.
- Preferences stores lightweight UI state only: lens, audio, accessibility, layout.
- Pixi consumes snapshots and render signatures; it should not own gameplay state.
- Solid reacts to selected Koota slices for HUD and drawer surfaces.

## Persistence Contract

Durable state belongs in SQLite:

- save slots: `autosave`, `campaign-a`, `campaign-b`, `sandbox`
- simulation event history: build, rent, reports, visits, contracts, milestones, victory
- corruption recovery quarantine for unreadable/unsupported saves

Lightweight state belongs in Preferences:

- active lens and camera defaults
- audio levels and mute state
- accessibility flags
- diagnostics visibility and HUD preferences

## Rendering Contract

- Pixi owns the tower cutaway and high-volume scene elements.
- Three.js remains background-only support for sky/depth.
- SVG assets are authored source material and should be composed through Pixi textures.
- Primitive blocks are acceptable for debug overlays and data lenses, not final room language.
- Static tower base art must stay cached behind deterministic render signatures.

## CI/CD Contract

The repo follows a standard arcade release lane:

- `.github/workflows/ci.yml`: PR validation
- `.github/workflows/release.yml`: release-please/tag lane
- `.github/workflows/cd.yml`: main-branch release gate, Pages deploy, Android debug build
- `.github/workflows/automerge.yml`: Dependabot and release-please automation only

Current deploy target:

- Web via GitHub Pages
- Android via debug artifact in CI, release path scaffolded through release workflow

## Current Technical Debt

- iOS shell exists in dependencies but there is no production iOS workflow or QA pass yet.
- Three.js sky/depth remains optional and lightly used; the main product value is still the 2D cutaway.
- More SVG asset breadth is needed so every production room family stops leaning on shared placeholder structure.
- Diagnostics and persistence are production-safe, but import/export UX is still developer-oriented.
