---
title: Known Issues
updated: 2026-04-23
status: current
domain: release
---

# Reach for the Sky — Known Issues

This is the release-time parking lot. Items here are **explicitly** waived for v1.0 — they do not block the cut. Each entry names the surface, the severity, and the target milestone for resolution.

## Visual / UX — deferred from T12 signoff

| Surface | Severity | Decision | Target |
|---|---|---|---|
| Night/day variants for the 12 new T08 room composites | low | Single-state composites read clearly across day/night sim cycles. Variants are nice-to-have, not a first-time-player problem. | post-1.0 |
| Event/visit-specific visual markers beyond the agent silhouettes | low | Current cutaway reads visit arrivals via floating particles + flock positioning + silhouette differentiation (T10/T12). Dedicated markers are authoring polish, not a comprehension gap. | post-1.0 |
| Stronger environmental differentiation between tower identities | medium | Identity already shifts cohort pool + agent trait deltas (T04). Environmental cue (sky tint, skyline density, etc.) tied to identity is a future pass, would deepen read but isn't required for journey legibility. | post-1.0 polish batch |

## Web Gates — deferred from T13

| Gate | Decision | Target |
|---|---|---|
| Lighthouse perf ≥90 / a11y ≥95 enforcement in verify:release | `@lhci/cli` adds ~40 MB of deps for marginal coverage over the existing `verify:render-stats` + new T13 console-clean gate. Real perf regressions show up in render stats or console errors first. If a real Lighthouse-caught regression lands post-1.0, add it then. | post-1.0 if justified |

## Platform / Release — out of scope for v1.0

| Gap | Decision | Target |
|---|---|---|
| iOS release lane (TestFlight / App Store) | Explicitly out of scope per PRD — Mean Streets precedent, Web + Android debug APK only for 1.0 | post-1.0 |
| Play Store listing, store assets, age rating, privacy disclosure | Not a v1.0 deliverable | post-1.0 |
| Release-signed Android AAB | Debug APK only for 1.0 | post-1.0 |
| Physical-device QA matrix execution | Automated CSS/sizing audit in T09 covers the invariants that actually regress between releases. Hardware traces are post-1.0 tuning work. | post-1.0 |
| Android Studio profiler traces on Pixel 5 reference | Same as above — post-1.0 tuning when a real player-facing perf problem surfaces. | post-1.0 |

## How items leave this list

1. A follow-up batch plan under `docs/plans/` picks the item up.
2. A PR lands that resolves the underlying surface.
3. The item is struck from this table in the same PR.

This file is a **waiver registry**, not a TODO list. Items that should be worked on next belong in `docs/plans/`, not here.
