---
title: Visual Review
updated: 2026-04-23
status: current
domain: ui
---

# Reach for the Sky — Visual Review

This document owns the visual direction, screenshot surfaces, and remaining art debt.

## Visual Direction

The game should read as authored architectural 2D, not colored block abstraction.

Required characteristics:

- restrained palette for structural materials
- identity through silhouettes, mullions, props, signage, and lighting
- strong lens overlays only when functionally needed
- no default reliance on large primary-color rectangles
- SVG-authored precision for rooms, interiors, and agent silhouettes

## Current Shipping Surfaces

- production landing page with atmosphere treatment
- desktop and mobile menu previews
- opening tower screenshots
- daily report and lens screenshots
- skyline charter, weather, and recovery scenario screenshots

## Screenshot Sources

Primary capture directory:

```text
test-screenshots/
```

Primary previews committed for player-facing surfaces:

```text
public/assets/previews/
```

## Room Family Coverage (T08, 2026-04-23)

Every `BuildingId` that represents an authorable room family now maps to a registered SVG composite. Before T08, 12 room families (`utilities`, `restroom`, `security`, `mechanical`, `eventHall`, `retail`, `skyGarden`, `observation`, `conference`, `clinic`, `gallery`, `luxurySuite`, `weatherCore`) fell through the `roomKey()` default to `null`, rendering as flat rects with element-only decoration. They now all route to authored layered composites.

Coverage is guarded by `tests/rendering/roomCoverage.test.ts`:

- every required family maps to ≥1 registered composite key
- every composite key resolves to an on-disk SVG file of non-trivial size
- every newly-authored T08 composite contains ≥4 painted elements (rect/path/circle/ellipse) — blocks future placeholder slop from sneaking through the file-exists check

If a new room family is added, the test will fail until the map is updated.

## T12 Signoff (2026-04-23)

Visual review is **signed off for v1.0** against the criteria in `docs/plans/release-1.0-batch.prq.md`. Each prior art-debt item lands in one of three buckets:

| Item | Status | Evidence |
|---|---|---|
| Placeholder-feeling room composites | resolved (T08) | 12 new composites authored; `tests/rendering/roomCoverage.test.ts` blocks regression |
| Dirt overlay flashing in cutaway | resolved (T10) | `drawDirt` now routes to the per-frame `roomOverlayLayer` instead of cache-gated `roomsLayer` |
| Landing page organization | resolved (T10) | StartScreen rewritten with progressive disclosure; `global.css` shed 551 lines |
| Agent silhouette variety | resolved (T12) | 3 new silhouettes (press, luxury, inspector) wired per cohort archetype at `agentVectorKey` |
| Touch-target sizing | resolved (T09) | `tests/ui/touchTargetAudit.test.ts` guards 44×44 minimum on primary mobile controls |
| Causal inspection legibility | resolved (T10) | Every inspection leads with a state-driven "because…" line |
| First-run explainer | resolved (T10) | 3-step modal with focus trap, preference-persisted |
| Night/day variants for T08 composites | deferred | `KNOWN_ISSUES.md` — single-state reads clearly |
| Dedicated event/visit visual markers | deferred | `KNOWN_ISSUES.md` — particles + silhouettes + flock positioning carry the read |
| Environmental cues tied to tower identity | deferred | `KNOWN_ISSUES.md` — post-1.0 polish batch |

## Review Standard

Every visible UI or rendering change should be checked against:

- desktop readability
- mobile readability
- drawer overlap with playfield
- lens clarity
- whether room identity is carried by authored detail instead of fill color
