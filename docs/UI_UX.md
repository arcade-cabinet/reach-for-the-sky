---
title: UI and UX
updated: 2026-04-23
status: current
domain: ui
---

# Reach for the Sky — UI and UX

This document owns shell layout, interaction model, and player explanation surfaces.

## Shell Layout

- top HUD: live essentials only
- left drawer: contracts, city brief, public pressure, reports, visit docket
- right drawer: settings, save/load, diagnostics, audio, accessibility
- main playfield: tower cutaway and interactions

## Current UX Principles

- construction must stay direct and drag-first
- drawers must not consume the entire game loop
- the tower should remain visible while most explanatory UI is open
- inspection should answer “what is happening and why” without cross-referencing multiple systems

## Start Surface

The production landing page now positions the game as a complete product rather than a prototype.

Shipping elements:

- branded hero and atmosphere treatment
- five-act framing
- scenario preview cards
- macro/meso/micro value proposition
- slot-aware continue flow

Remaining work:

- stronger polish on marketing copy rhythm and CTA hierarchy
- potentially richer store/trial funnel segmentation
- continued review of how much surface area the start screen consumes on smaller laptops

## Inspection Layer

Shipping:

- room inspections
- elevator inspections
- public-story focus inspections
- contract diagnostics with lens/build actions
- **causal "because..." line at the top of every inspection** (T10): every room, agent, elevator, and empty-cell inspection leads with a reasoning line tied to current simulation state (dirt level, transit pressure, agent wait burden, route-block state, identity drift, market cycle). Players get *why this matters right now* before the raw numbers.

Remaining work:

- better comparison language between current value and target state
- more explicit touch affordances for inspection on mobile

## First-Run Explainer (T10)

A 3-step modal plays once on first launch, persisted via `preferences.tutorialStep = "completed"`. Steps:

1. Introduces the living-tower framing (every person is an algorithm, emergent not scripted)
2. Teaches the cutaway + lens row
3. Points at identity declaration in the contracts drawer

Keyboard-accessible (Enter/Space/→ advance, ← back, Esc skip). Skip and Start-building buttons both persist completion so it never replays. Dismissable without blocking; not a tutorial — a framing.

## Tooltips

All primary HUD and drawer buttons carry `title` attrs that explain purpose and keyboard affordance where relevant: Contracts drawer, Pause/Play/Fast speed controls, Settings drawer button. More to follow as drawer sections grow.

## Mobile UX

Shipping:

- touch drag build flow verifier
- drawer/button access on small screens
- top HUD compression
- Android native back button closes Settings/Contracts drawers first, then pauses to Settings, then falls back to history/minimize behavior

Remaining work:

- more manual QA on edge-case touch interactions
- stronger safe-area tuning and device-matrix review
- reduced-motion and large-interface-scale visual review on physical devices
