---
title: Press Kit
updated: 2026-04-24
status: current
domain: release
---

# Reach for the Sky — Press Kit

Everything a journalist, store reviewer, or community curator needs to accurately describe the game and source a canonical screenshot. This doc is the single-source reference; all imagery lives under `public/assets/previews/` and ships with the web build.

## Fact sheet

| Field | Value |
|---|---|
| Title | Reach for the Sky |
| Genre | Living-tower simulator |
| Platforms (v1.0) | Web (GitHub Pages), Android debug APK |
| Engine | Solid + Pixi + Koota + Yuka + Capacitor |
| Pricing | Free |
| Source | [arcade-cabinet/reach-for-the-sky](https://github.com/arcade-cabinet/reach-for-the-sky) |
| Live | `https://arcade-cabinet.github.io/reach-for-the-sky/` |

## One-line pitch

> A simulation-first tower-builder where architecture, tenants, crowds, inspectors, weather, money, and public memory collide until your building earns a role in the city.

## One-paragraph description

Reach for the Sky is a living-tower simulator. You place rooms, shafts, and elevators inside a 2D cutaway, and the city reacts — not through a 5-star ladder, but through agents with their own goals, cohorts that remember how they were treated, identity declarations that change what obligations you inherit, and weather fronts that test what you built. The five-act journey is emergent from play, not scripted. The building you finish with is the one the city decides you built.

## Pillars

These are the invariants reviews should lean on; everything else is surface.

1. **Per-person GOAP, not predictable AI** — every visitor chases their own goal. Two people in the same cohort can take different paths through your tower.
2. **No SimTower ladder** — the five-act spine is a frame, not a checklist. Identity, public memory, and crowd behavior drive what happens next.
3. **Simulation-first** — spectacle supports the cutaway. It does not replace it.
4. **Open stack** — Solid, Pixi, Koota, Yuka, Capacitor. No proprietary layer.
5. **Authored visual identity** — every room family, agent silhouette, and inspection line is deliberately composed. Placeholder geometry is not the aesthetic.

## Canonical screenshots

All images under `public/assets/previews/`. The selection below is the **press-kit subset** — one shot per storytelling beat. Use any of them; if only one, use the opening shot.

| # | File | Beat | Pillar tied |
|---|---|---|---|
| 1 | `opening-desktop.png` | The first tower. A lobby, a floor, a first elevator — the moment the simulation starts reacting to you. | Simulation-first |
| 2 | `skyline-victory-desktop.png` | A declared identity (skyline charter) with public memory shaping rotating mandates. The building has a role in the city. | No SimTower ladder |
| 3 | `weather-stress-desktop.png` | Height risk, storm pressure, safety readiness. Emergent consequence, not a scripted tutorial beat. | Per-person GOAP |
| 4 | `recovery-contract-desktop.png` | A reputation dent turned into targeted repair contracts — public memory in action. | No SimTower ladder |
| 5 | `daily-report-desktop.png` | The daily operating diagnosis. Where legibility lives; every number ties to a decision. | Simulation-first |
| 6 | `privacy-lens-desktop.png` | One of the readability lenses. Inspection isn't chrome — it's how the tower earns its grade. | Authored visual identity |
| 7 | `menu-desktop.png` | Landing / scenario selection. Progressive disclosure: hero first, detail on scroll. | Authored visual identity |
| 8 | `menu-mobile.png` | Same landing, 390×844. Drawers reachable, touch targets ≥44×44 (T09 audit). | Authored visual identity |
| 9 | `opening-mobile.png` | First tower on mobile. Cutaway scales to the portrait viewport without losing read. | Simulation-first |

All shots are regenerated on every `verify:release` run via `pnpm capture:screenshots` (`scripts/capture-screenshots.mjs`). When a shot goes stale — UI shift, art pass, lens rename — the release gate fails visually on the landing before the cut, which is the intended pressure.

## Captioning guidance

Captions for external use should lead with the beat, not the feature. "A damaged reputation becomes a targeted repair contract" reads; "recovery arc contract UI" doesn't. The pillar column above is a prompt, not a mandate.

## What to avoid

- **Don't call it a prototype, POC, or demo.** It is not. Production constraints apply — see `STANDARDS.md`.
- **Don't compare it to SimTower without the pivot noted.** The design brief is explicit: no obvious path to five stars. Reviews that call it "SimTower with GOAP" miss the part that matters.
- **Don't describe it as scripted campaign.** The five acts are emergent from play. There is no fixed sequence of scripted beats.
- **Don't request a "trailer"** — v1.0 ships with the live site and the captures above. A trailer is post-1.0.

## Changelog + credits

- Changelog: `CHANGELOG.md` in the repo root.
- Credits and stack: `README.md`.
- Design canon: `docs/DESIGN.md`.
- Known deferrals: `docs/KNOWN_ISSUES.md`.

## Contact

Open a GitHub issue on the repository. This is a first-party, open-source release; there is no separate press contact for v1.0.
