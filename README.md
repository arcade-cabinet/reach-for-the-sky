# Reach for the Sky

Reach for the Sky is a modern living-tower simulator where architecture, people, reputation, and city pressure collide. Build from an empty lot into a district-defining institution, then keep the tower credible under contracts, visits, scrutiny, and weather.

## What Ships Today

- standalone Solid + Pixi + Koota + Yuka + Capacitor app
- five-act campaign-backed sandbox spine
- save/load, autosave, event history, and corrupt-save recovery
- top HUD with left/right drawer shell
- public-memory, visit, and repair-contract systems
- GitHub Pages deployment and Android debug CI packaging

## Documentation

Canonical docs live in [`docs/`](./docs):

- [`docs/DESIGN.md`](./docs/DESIGN.md)
- [`docs/SYSTEMS.md`](./docs/SYSTEMS.md)
- [`docs/CONTENT.md`](./docs/CONTENT.md)
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`docs/UI_UX.md`](./docs/UI_UX.md)
- [`docs/VISUAL_REVIEW.md`](./docs/VISUAL_REVIEW.md)
- [`docs/TESTING.md`](./docs/TESTING.md)
- [`docs/PRODUCTION.md`](./docs/PRODUCTION.md)
- [`docs/RELEASE.md`](./docs/RELEASE.md)
- [`docs/STATE.md`](./docs/STATE.md)
- [`STANDARDS.md`](./STANDARDS.md)

If a code change alters product behavior, architecture, or the remaining-work picture, update the matching docs file in the same branch.

## Architecture

- `app/`: Solid shell, HUD, drawers, and canvas host
- `src/simulation/`: pure placement, economy, campaign, public-memory, visitor, and reporting systems
- `src/state/`: Koota traits, world, and actions
- `src/rendering/`: Pixi cutaway renderer and optional Three sky/depth support
- `src/persistence/`: SQLite save/event storage and Preferences KV wrappers
- `src/audio/`: Tone procedural cues and Howler OGG sprite playback
- `public/assets/`: vectors, previews, icons, audio, and SQL WASM

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:browser
pnpm verify:release
pnpm capture:screenshots
pnpm exec cap sync android
```

## Shipping Flow

- PRs run `ci.yml`
- `main` runs `release.yml` and `cd.yml`
- `automerge.yml` is restricted to Dependabot and release-please PRs
- Pages deploy target: [https://arcade-cabinet.github.io/reach-for-the-sky/](https://arcade-cabinet.github.io/reach-for-the-sky/)

## Remaining Work

The explicit remaining-work list is maintained in [`docs/PRODUCTION.md`](./docs/PRODUCTION.md). The short version:

- broaden room/cohort/art content depth
- improve mobile and inspection UX
- expand audio breadth
- define full iOS/store-submission readiness
