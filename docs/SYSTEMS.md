---
title: Systems
updated: 2026-04-23
status: current
domain: gameplay
---

# Reach for the Sky — Systems

This document owns the simulation domains: tower operations, economy, campaign, contracts, visits, and memory. Identity/vision lives in [DESIGN.md](./DESIGN.md). Technical implementation lives in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Shipped System Domains

### Construction

- drag-based placement for lobby, floor, elevator, and room families
- placement validation and support rules
- camera pan/zoom and lens toggles
- touch-capable construction flow coverage

### Tower Operations

- rent loop
- cleanliness/service pressure
- transit pressure
- venue readiness
- safety/privacy/noise metrics
- operations grade and supporting diagnostics

### Campaign

- five internal pacing anchors (Empty Lot, Working Tower, District Player, Public Landmark, Reach for the Sky)
- phase advancement gated by a state predicate (cohort mix, identity drift, public-memory weight, pressure signatures) — **not** a clock or checklist
- permit tier counter exists internally but is never surfaced as a player-facing progression ladder
- skyline-charter legitimacy endpoint
- post-endpoint sandbox city-cycle mandate generation

Anti-pattern (rejected): a SimTower-style visible star ladder with an obvious path from one star to the next. If it ever reappears in a player-facing surface (`Act N of 5`, numbered stars, progression ladder), treat it as a regression.

### Contracts

- authored act contracts
- reactive contracts from operating failures
- public-memory repair contracts
- contract objective diagnostics with lens/build recommendations

### Public Pressure

- latest public story
- dominant pressure reason and bottleneck
- actionable focus inspection and lens direction
- durable memory records with pressure reasons

### Visits And Cohorts

- generated hosting forecast
- explicit invite flow
- active visit commitment state
- representative routing through the live tower
- outcome generation and durable memory creation

### Persistence

- save slots
- autosave on meaningful milestones
- durable event rows
- corrupt-save recovery surface

### Reports

- end-of-day report generation
- revenue/costs/net summary
- queue/dirt/trust/reputation summaries
- next-risk forecasting

## Current Cohort Logic

Cohorts derive from tower state instead of rigid milestones. The shipped archetype surface already supports:

- status-sensitive groups
- pragmatic groups
- low-patience public groups
- generous/patient groups
- quiet-order groups

Those traits currently inform:

- hosting forecast labels
- dealbreakers and values
- Yuka hosting priorities
- public pressure reasons
- public memory and repair contracts

## Remaining System Work

### Tower Breadth

- deeper floor-band specialization
- more room synergies and adjacency consequences
- better staffing/service interplay
- richer failure/recovery loops for late-game towers

### Cohort Breadth

- larger authored archetype library
- stronger multi-cohort city-cycle generation
- more distinctive outcomes between civic, luxury, labor, tourist, and media groups
- better flock-specific pathing and group cohesion behavior

### Sandbox Depth

- rotating district cycles with broader mandate variety
- stronger late-game economic/political tradeoffs
- more reasons to re-specialize or rebalance an established tower

### Failure States

- more explicit soft-failure arcs before trust collapse
- clearer distinction between temporary embarrassment and structural institutional damage
- richer recovery content beyond current repair-contract chain
