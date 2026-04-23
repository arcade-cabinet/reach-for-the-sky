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

## Highest-Priority Remaining Art Debt

- broader SVG variation for late-game room families
- richer agent silhouette variety
- better event/visit-specific visual markers
- stronger environmental differentiation between tower identities
- continued removal of any remaining placeholder-feeling room surfaces

## Review Standard

Every visible UI or rendering change should be checked against:

- desktop readability
- mobile readability
- drawer overlap with playfield
- lens clarity
- whether room identity is carried by authored detail instead of fill color
