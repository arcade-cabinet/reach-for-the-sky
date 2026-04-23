---
title: Release 1.0 Task Batch
updated: 2026-04-23
status: active
domain: planning
---

# Reach for the Sky — Release 1.0 Task Batch

This is the canonical task batch for cutting a **real 1.0**: the web build hardened and gated, an Android debug APK shipped the way Mean Streets ships (no full Play Store release lane), and the simulation reframed around the product's actual pillar — a modernized skyscraper builder where every person is a free-thinking algorithm, explicitly **not** a star-ladder progression game.

Scope chosen: **Store-submission 1.0 minus store submission.** Web + Android debug only. No iOS release lane. No Play/App Store assets. Timeframe: open-ended. Execution: continue on failure, dependency-ordered.

## Pillars (binding for every task)

1. **Every person is an algorithm, but not a predictable one.** Per-agent GOAP goals + flock behavior. Emergent reactions, not scripted beats.
2. **No obvious SimTower star path.** The five-act spine must survive as internal pacing structure only — never surface as a visible "Act N of 5" ladder or star-style progression UI.
3. **Simulation-first; spectacle supports the cutaway.** (From `CLAUDE.md`.)
4. **Solid / Pixi / Koota / Yuka / Capacitor only.** No React, R3F, Zustand, Dexie.

## Config

```yaml
batch_name: release-1.0
stop_on_failure: false
auto_commit: true
priority_mode: auto_by_dependency
target: Web (Pages) + Android debug APK
```

---

## Tasks

Ordered by dependency. Earlier tasks unblock later ones.

### T01 — Reframe campaign from scripted acts to emergent beats

**Priority:** P1 (foundational — downstream content tasks depend on this reframe)
**Files:** `src/campaign/*`, `docs/DESIGN.md`, `docs/CONTENT.md`, `docs/SYSTEMS.md`
**Dependencies:** none

Strip visible act-progression UI. Acts remain as internal pacing anchors that unlock from observed simulation state (cohort diversity, agent conflict, identity drift) rather than a linear clock. No "Act N of 5" label, no star-style progression markers, no obvious completion ladder. Narrative surfaces as event cards describing what the tower actually did.

**Completion criteria**

- [ ] Grep of `src/` + built HTML for `Act \d`, `star`, `stars`, `progress bar` shows no player-facing progression ladder
- [ ] `docs/DESIGN.md` updated: campaign pillar rewritten around emergent-from-play, with anti-pattern callout naming SimTower's star path
- [ ] `docs/CONTENT.md` + `docs/SYSTEMS.md` updated: act-unlock is described as a state predicate over cohort/identity/tower state, not a clock
- [ ] Existing campaign proof flow still reaches the late-game sandbox (no regression)
- [ ] `pnpm typecheck && pnpm test && pnpm build` green

### T02 — Per-person GOAP goals

**Priority:** P1
**Files:** `src/sim/agents/*`, `src/sim/goals/*`, `docs/SYSTEMS.md`
**Dependencies:** T01

Each tenant/visitor runs distinct goals + utility evaluation. No shared script. Goals must be authored per cohort archetype and respond to tower state (rooms available, staffing, identity).

**Completion criteria**

- [ ] Each cohort archetype declares its goal set in an authored data file (not inline code)
- [ ] Agents select goals via utility scoring; two agents of the same archetype in different tower contexts make different decisions (unit test)
- [ ] `docs/SYSTEMS.md` documents the goal/utility loop with a small worked example
- [ ] `pnpm test` covers goal selection divergence
- [ ] Performance: goal evaluation for 200 concurrent agents under 4ms/frame on the reference dev profile

### T03 — Flock / group behavior

**Priority:** P1
**Files:** `src/sim/steering/*`, `src/sim/groups/*`
**Dependencies:** T02

Yuka-backed steering for conventions, elevator queues, lobbies, large cohorts. Groups exhibit emergent crowd patterns (bottleneck, dispersal, clustering) rather than scripted formations.

**Completion criteria**

- [ ] Group steering implemented for at least: elevator queue, lobby gathering, convention floor
- [ ] Deterministic soak: 500-tick sim with 3 simultaneous convention cohorts does not deadlock or clip through geometry
- [ ] Visible in the cutaway without frame drops on mid-tier Android reference device
- [ ] Integration test asserts group dispersal after event conclusion

### T04 — Reactive identity shifts

**Priority:** P1
**Files:** `src/sim/identity/*`, `src/sim/agents/*`, `docs/CONTENT.md`
**Dependencies:** T02

Agents' goals respond to tower identity declarations and cohort mix over time. Declaring a luxury identity visibly changes later visitor goals and cohort availability.

**Completion criteria**

- [ ] Identity table in `docs/CONTENT.md` maps each identity → goal-weight deltas + cohort-pool shifts
- [ ] Regression test: flipping identity mid-run produces distinct downstream agent behavior within N ticks
- [ ] Identity consequence is legible via the Inspection upgrade (T10)

### T05 — Dev-only agent debug overlay

**Priority:** P2
**Files:** `src/dev/overlay/*`
**Dependencies:** T02

Dev-only overlay showing each agent's current goal + plan. Gated behind a dev flag or hotkey, stripped from production builds.

**Completion criteria**

- [ ] Toggle via hotkey or `?debug=agents` URL param
- [ ] Overlay shows goal name, utility score, current plan step per selected agent
- [ ] Absent from production bundle (verified via `pnpm build` output grep)

### T06 — Cohort archetype breadth + data-driven authoring

**Priority:** P1
**Files:** `src/content/cohorts/*.json` (new authored data), `src/sim/cohorts/*`
**Dependencies:** T02

Broaden archetype library. Move cohort + outcome tables into readable authored data files (not inline code). Hit a published archetype-count floor.

**Completion criteria**

- [ ] ≥ 12 distinct cohort archetypes, each with ≥ 3 distinct visit outcome paths wired to room/staff state
- [ ] Cohort + outcome tables live in versioned data files, not TS literals
- [ ] Golden-snapshot test of cohort roster committed to prevent silent content loss
- [ ] `docs/CONTENT.md` table enumerates every archetype with 1-line descriptor

### T07 — Late-game sandbox depth

**Priority:** P2
**Files:** `src/sim/contracts/*`, `src/sim/institutions/*`, `src/content/contracts/*`
**Dependencies:** T06

Contract variety expansion, authored failure→recovery arcs for late-game institutions, and a sandbox soak verifying no loop dead-ends.

**Completion criteria**

- [ ] New late-game contract types with distinct win/fail conditions authored and playable
- [ ] At least 3 institutions have explicit failure→recovery arcs (authored, not generic)
- [ ] Deterministic soak: 10k-tick run from a seed-locked sandbox save produces no stall, no NaN, no negative counters
- [ ] `docs/CONTENT.md` updated with contract/arc tables

### T08 — Authored room-family SVG coverage

**Priority:** P1
**Files:** `src/art/rooms/*.svg`, `src/art/agents/*.svg`, `src/art/events/*.svg`, `docs/VISUAL_REVIEW.md`
**Dependencies:** T01

Every room family has an authored SVG composite. Vector coverage extends to event markers and agent silhouettes. No placeholder-feeling fill shapes in any player-facing surface.

**Completion criteria**

- [ ] 100% room family coverage with authored SVG composites (file-exists check + audit grep for placeholder primitives)
- [ ] Event markers + agent silhouettes authored as vectors
- [ ] `docs/VISUAL_REVIEW.md` visual-debt table refreshed with before/after screenshots
- [ ] `pnpm capture:screenshots` diff committed in PR as visual evidence

### T09 — Mobile + touch QA pass

**Priority:** P2
**Files:** `docs/TESTING.md`, `src/ui/*` (fixes from audit)
**Dependencies:** T08

Deep touch QA on the Android debug APK. Inspection + drawers reachable and usable on small screens. Meet a real perf budget on mid-tier hardware.

**Completion criteria**

- [ ] QA matrix executed across ≥ 3 Android form factors; results captured in `docs/TESTING.md` mobile section
- [ ] All interactive elements meet 44×44 pt minimum; audit script + manual pass
- [ ] 60fps p50 / no sustained dropped-frame clusters on mid-tier Android reference device
- [ ] `pnpm cap:sync:android` + fresh debug APK build verified on device

### T10 — Inspection depth + first-use clarity

**Priority:** P2
**Files:** `src/ui/inspection/*`, `src/ui/onboarding/*`, `docs/UI_UX.md`
**Dependencies:** T04, T06

Every inspectable entity (room, cohort, contract, agent) shows causal **why** alongside state. First-run explainer introduces the cutaway, drawers, and identity declaration. Contextual tooltips on HUD + drawer controls.

**Completion criteria**

- [ ] First-run explainer plays once, persisted via Preferences
- [ ] Every inspection panel shows at least one "because…" line tied to current sim state
- [ ] Tooltips on every HUD + drawer control (hover + long-press)
- [ ] `docs/UI_UX.md` updated to reflect shipped explainer/tooltip system

### T11 — Audio expansion

**Priority:** P3
**Files:** `src/audio/*`, `public/audio/*`, `docs/AUDIO.md` (new)
**Dependencies:** none

Sourced OGG set covering UI + ambience + event cues. Contextual procedural score responsive to tower state without hurting readability. Audio settings persisted.

**Completion criteria**

- [ ] Sourced OGG set expanded beyond the current UI cue sprite (documented source + license per file)
- [ ] Contextual procedural score layer responds to tower pressure/cohort density
- [ ] Master/music/sfx volume + mute persisted via Preferences and honored on reload
- [ ] `docs/AUDIO.md` documents sources, licenses, triggers, persistence

### T12 — Visual review signoff

**Priority:** P3
**Files:** `docs/VISUAL_REVIEW.md`, `scripts/capture-screenshots.*`
**Dependencies:** T08, T09, T10

Screenshot-based polish pass against the `VISUAL_REVIEW.md` bar. Visual debt declared closed for 1.0 or explicitly waived in known-issues.

**Completion criteria**

- [ ] `pnpm capture:screenshots` produces the full matrix green
- [ ] `docs/VISUAL_REVIEW.md` declares each debt item resolved or deferred to `docs/KNOWN_ISSUES.md`
- [ ] No placeholder-feeling surface in committed screenshots

### T13 — Web 1.0 harden (Lighthouse + error budget)

**Priority:** P2
**Files:** `scripts/verify-release.*`, `scripts/verify-browser.*`, `.github/workflows/ci.yml`
**Dependencies:** T08, T10

Enforce Lighthouse perf ≥ 90 / a11y ≥ 95, zero console errors across the verify:browser matrix, and a headless campaign-start-to-act-3 smoke in `verify:release`.

**Completion criteria**

- [ ] Lighthouse budget enforced in `verify:release` (fails the script on regression)
- [ ] `verify:browser` fails on any console error/warning
- [ ] Headless campaign smoke run reaches act-3 equivalent state from a clean save
- [ ] CI runs all three in `pull_request` workflow

### T14 — Save-compat smoke against 1.0.1 baseline

**Priority:** P2
**Files:** `scripts/verify-save-compat.*`, `src/persistence/migrations/*`
**Dependencies:** T02, T04, T06

Automated load of saves captured on the 1.0.1 baseline. Migration + corrupt-save recovery paths verified.

**Completion criteria**

- [ ] Baseline saves committed under `testdata/saves/1.0.1/*`
- [ ] Smoke script loads each, runs N ticks, asserts no schema crash and no data loss
- [ ] Script wired into `verify:release`

### T15 — docs/LAUNCH.md launch-readiness checklist

**Priority:** P1
**Files:** `docs/LAUNCH.md` (new)
**Dependencies:** T13, T14, T09

New doc with platform-by-platform launch checklist. Web (Pages) + Android debug APK lanes only. Explicitly states iOS and full store submission are out of scope for 1.0.

**Completion criteria**

- [ ] `docs/LAUNCH.md` exists with Web + Android checklists, gate-by-gate
- [ ] Out-of-scope section explicitly names iOS and store submission as post-1.0
- [ ] Linked from `README.md` and `docs/PRODUCTION.md`
- [ ] Every gate references the concrete verification command or artifact

### T16 — Screenshot press kit

**Priority:** P3
**Files:** `docs/press/*`, `scripts/capture-screenshots.*`
**Dependencies:** T08, T12

Final screenshot set captured via `capture:screenshots`, committed under `docs/press/`. Not store-submission assets — just the authored visual record of 1.0.

**Completion criteria**

- [ ] `docs/press/` contains the full 1.0 screenshot set
- [ ] `docs/press/README.md` inventories each shot with caption + capture command

### T17 — Known-issues registry

**Priority:** P2
**Files:** `docs/KNOWN_ISSUES.md` (new)
**Dependencies:** all content/UX tasks above

Registry of ship-blockers waived and post-1.0 items, with owner and target milestone.

**Completion criteria**

- [ ] `docs/KNOWN_ISSUES.md` exists with every waived item, severity, and post-1.0 target
- [ ] Cross-linked from `docs/LAUNCH.md` and `docs/PRODUCTION.md`

### T18 — Cut v1.0.0 via release-please

**Priority:** P1 (final gate)
**Files:** release-please config/manifest, `CHANGELOG.md`
**Dependencies:** T01–T17 all merged

Cut v1.0.0 (release-please). Full changelog generated. Pages deploy + Android debug APK artifact attached to the release.

**Completion criteria**

- [ ] release-please PR merged; tag `v1.0.0` exists on origin
- [ ] `CHANGELOG.md` reflects the full batch
- [ ] Pages shows the v1.0.0 build serving HTTP 200
- [ ] Android debug APK artifact attached to the GitHub Release
- [ ] `docs/STATE.md` + `docs/PRODUCTION.md` updated: 1.0 declared shipped, post-1.0 work handed to `post-1.0-polish-batch.prq.md`

---

## Execution Order

```
T01 → T02 → T03, T04, T05, T06 (parallelizable after T02)
              ↓
              T07 (needs T06)
T08 (depends on T01) → T09 (needs T08) → T10 (needs T04, T06)
T11 (independent, any time)
T12 (after T08, T09, T10)
T13 (after T08, T10)
T14 (after T02, T04, T06)
T15 (after T13, T14, T09)
T16 (after T08, T12)
T17 (after all content/UX tasks)
T18 (final — after everything)
```

## Exit Criteria for the Batch

- All P1 tasks complete, all P2 tasks complete or explicitly waived in `docs/KNOWN_ISSUES.md`
- Web + Android debug lanes both green end-to-end
- `docs/LAUNCH.md`, `docs/KNOWN_ISSUES.md`, `docs/AUDIO.md` exist
- Player-facing UI never surfaces a SimTower-style act/star ladder (grep clean)
- `v1.0.0` tag published, Pages live, APK attached

## Out of Scope (explicit)

- iOS release lane / TestFlight / App Store
- Play Store listing, store assets, age rating, privacy disclosure
- Release-signed Android AAB (debug APK only, per Mean Streets precedent)
- Any reintroduction of React, R3F, Zustand, or Dexie

## After T18

Tagging `v1.0.0` is not "done." It is a checkpoint. The game is only finished when a player who has never seen it before can land on the page and fluently understand the entire journey — clearly communicated goals, legible objectives, and a satisfying end-of-game — without chat archaeology or a tutorial read.

After T18 merges, continue autonomously:

1. Observe the live web deploy from a cold-start player perspective.
2. Identify the biggest comprehension, pacing, polish, or visual gap in that journey.
3. Open a follow-up batch plan under `docs/plans/` describing that gap and the fix. Use `mcp__magic__*` (component inspiration, refiner) as the free path for visual/UX ideation since store credits are unavailable.
4. Execute the follow-up batch the same way — PR per task, address review feedback, resolve threads, merge, move on.
5. Repeat until the first-time-player test passes.

Deliverables are discovery checkpoints, not stop points.
