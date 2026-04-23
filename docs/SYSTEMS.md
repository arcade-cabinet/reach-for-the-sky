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

### Agent Goals (per-person GOAP utility)

Every tenant and visitor is an independent algorithm, not a shared script. The decision loop is Yuka-backed (`yuka.GoalEvaluator`, `yuka.Think`):

1. Each archetype declares its goal set + traits in an authored data file under `src/content/cohorts/*.json`. No more inline TS literals.
2. At decision time, every candidate goal's utility is scored against current tower state (cleanliness, service pressure, transit pressure, noise/privacy comfort) **and** the agent's own traits (patience, cleanliness demand, status sensitivity, group cohesion, ego, privacy demand).
3. The highest-scoring goal wins — so two `movie-star` cohorts in different towers almost never pick the same top priority, and three different archetypes in the same tower often pick three different top priorities.

Worked example: drop a `movie-star` cohort into a clean, calm tower (cleanliness 95, service pressure 12, noise control 92) and the hosting plan's primary is `protect-privacy`. Drop the same cohort into a dirty, crowded tower (cleanliness 18, service pressure 82, noise control 25) and the primary flips to `clean-public-rooms` or `buffer-noise`. Same archetype, different decisions. See `tests/simulation/cohortGoapDivergence.test.ts`.

This is the binding implementation of Pillar 1 in `docs/plans/release-1.0-batch.prq.md`: every person is a free-thinking algorithm, and the simulation's emergent feel must come from these utility-scored reactions rather than from scripted beats.

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
