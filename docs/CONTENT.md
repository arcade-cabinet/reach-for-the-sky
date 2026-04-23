---
title: Content Domains
updated: 2026-04-23
status: current
domain: content
---

# Reach for the Sky — Content Domains

This document owns the content inventory: room families, lenses, cohorts, scenarios, and internal phase anchors.

> **Progression framing.** The five internal phases (`Empty Lot`, `Working Tower`, `District Player`, `Public Landmark`, `Reach for the Sky`) are authoring scaffolding, not a player-facing ladder. Player-facing surfaces never label them `Act N`, never number them, and never render them as a progression ladder. Phase transitions must unlock from a **state predicate** over cohort mix, identity drift, public-memory weight, and pressure signatures — not from a clock or checklist. See `DESIGN.md` → *Progression Philosophy — Emergent, Not Laddered*.

## Room Families

### Shipping

- lobby
- floor
- elevator
- office
- condo
- cafe
- hotel
- maintenance
- utilities
- restroom
- security
- mechanical
- conference
- event hall
- retail
- sky garden
- observation
- clinic
- gallery
- luxury suite
- weather core

### Still Content-Light

These room families are functional but still need broader authored visual and systemic differentiation:

- utilities
- restroom
- security
- mechanical
- conference
- event hall
- retail
- clinic
- gallery
- luxury suite
- weather core

## Lenses

Shipping lenses:

- normal
- maintenance
- transit
- value
- sentiment
- privacy
- safety
- events

Remaining work:

- tighter visual language per lens
- stronger room/agent-specific overlays
- more explicit explanation copy for first-time users

## Campaign Scenarios

Shipping preview-backed scenarios:

- Working Tower
- Skyline Charter
- Weather Front
- Public Recovery

Purpose:

- player-facing city moments, not debug entries
- capture key slices of the five-act journey
- support marketing previews and browser verification

## Identity Consequences (authored, T04)

Tower identity is not a cosmetic label — each declared identity **reactively shifts** both the cohort pool the city sends and the trait vector those cohorts arrive with. The authored table lives in `src/content/identity/*.json` and is consumed at cohort-generation time in `src/simulation/visitors.ts`.

| Identity | Archetype pool bias (added weight) | Trait delta on every arriving cohort |
|---|---|---|
| `unformed` | (none) | (none) |
| `business` | trade-buyers +0.5, politician +0.25, labor-delegation +0.2 | patience −0.05, noiseTolerance +0.08, statusSensitivity +0.05 |
| `residential` | school-teachers +0.28, stamp-collectors +0.2, buddhist-monks +0.16 | groupCohesion +0.05, patience +0.06, noiseTolerance −0.06 |
| `hospitality` | movie-star +1.15, foreign-prince +0.76, trade-buyers +0.36 | spendingPower +0.07, cleanlinessDemand +0.06, privacyDemand +0.08 |
| `civic` | school-teachers +0.36, buddhist-monks +0.24, city-inspectors +0.28 | kindness +0.06, patience +0.05, statusSensitivity −0.06 |
| `luxury` | movie-star +1.25, foreign-prince +0.95 | statusSensitivity +0.1, privacyDemand +0.09, spendingPower +0.08, cleanlinessDemand +0.06 |
| `mixed-use` | school-teachers +0.12, trade-buyers +0.14, movie-star +0.1, politician +0.08 | noiseTolerance +0.04, groupCohesion −0.04 |

Trait deltas are clamped to `[0, 1]`, applied on top of the cohort's archetype trait vector (plus per-visit RNG variation). Flipping identity mid-run visibly shifts both the cohort distribution and what individual agents prioritize — verified by `tests/simulation/identityShifts.test.ts`.

## Cohort/Visit Surface

Authored archetype roster (13 total — authored in `src/content/cohorts/*.json`, loaded by `src/content/cohorts/index.ts`, snapshot-tested in `tests/simulation/cohortRoster.snap.test.ts`):

| Archetype | Label | Size | Goals | Notes |
|---|---|---|---|---|
| `movie-star` | Movie star entourage | 3–12 | publicity, lodging, food | hospitality/luxury pool |
| `foreign-prince` | Foreign prince and retainers | 6–24 | lodging, shopping, food | hospitality/luxury pool |
| `politician` | Campaign delegation | 8–30 | publicity, meeting, food | business pool |
| `press-swarm` | Press swarm | 6–26 | publicity, meeting, food | scandal-driven |
| `buddhist-monks` | Buddhist monks | 4–18 | quiet, food | civic/residential pool |
| `school-teachers` | School teacher convention | 24–90 | meeting, food, shopping | civic/residential pool |
| `stamp-collectors` | Stamp collector convention | 12–48 | quiet, meeting, shopping | residential pool |
| `labor-delegation` | Labor delegation | 10–42 | meeting, food | business/trust-driven |
| `trade-buyers` | Trade buyers | 16–64 | shopping, meeting, food | business/commerce |
| `city-inspectors` | City inspector tour | 3–10 | meeting, quiet | regulation/weather-driven |
| `film-festival-jury` | Film festival jury | 4–14 | publicity, quiet, food | hospitality/luxury pool |
| `tech-investors` | Tech investor summit | 8–36 | meeting, food, shopping | business pool |
| `civic-delegation` | Civic delegation | 6–24 | meeting, publicity | civic pool |

Each archetype has ≥2 goals and every visit resolves to one of three outcome paths (`praised | mixed | complained`) driven by `evaluateCohortFriction` over current tower state — so "≥3 distinct visit outcome paths per archetype" is guaranteed by the system, not authored per-cohort.

## Recovery Arcs (T07)

Late-game institutions no longer just break — they degrade through authored phases. Three institutions currently have arcs in `src/content/recovery/*.json`, each declaring a trigger predicate, a `soft-failure → recovery-contract → escalation` chain, and per-phase rewards and penalties:

| Institution | Trigger | Arc phases |
|---|---|---|
| `skyline-landmark` | public trust < 45 | soft-failure → recovery-contract → charter-revocation |
| `convention-hall` | failed visits ≥ 2 | soft-failure → recovery-contract → booking-freeze |
| `hospitality-wing` | tenant satisfaction < 55 | soft-failure → recovery-contract → luxury-exodus |

Each escalation step has its own headline, brief, success condition, and reward/penalty values. A 10k-tick deterministic sandbox soak (`tests/simulation/sandboxSoak.test.ts`) verifies the simulation advances monotonically without NaN, stalls, or negative counters under late-game conditions, seed-locked to `0x5eed_4104` for regression stability.

## Internal Phase Content Status

Phases are internal pacing anchors (see DESIGN.md). Unlock predicates are state-driven, not clock-driven. Content status refers to authored breadth available when a phase is reached:

| Phase | Unlock predicate (target) | Content status |
|---|---|---|
| Empty Lot | cold start | playable |
| Working Tower | sustained occupancy + first pressure events observed | playable |
| District Player | identity signal crossing threshold from cohort mix | playable |
| Public Landmark | public-memory accumulation + visit diversity | playable through public-memory/repair flow |
| Reach for the Sky | sustained legitimacy + late-game stressors | playable with skyline charter and sandbox mandate |

Remaining content work is mostly about breadth, authored variety, and stronger differentiation inside each phase rather than missing the basic spine. Writing or surfacing any `Act N of 5` label or star-ladder progression UI is explicitly out of bounds.
