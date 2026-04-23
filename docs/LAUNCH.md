---
title: Launch Readiness
updated: 2026-04-23
status: current
domain: release
---

# Reach for the Sky — Launch Readiness (v1.0)

This is the day-of-launch signoff checklist. It is the last gate before merging the release-please PR that cuts `v1.0.0`.

`docs/RELEASE.md` owns the *procedure*. `docs/PRODUCTION.md` owns the *scope*. This doc owns the *go/no-go moment*.

## Scope for v1.0

Web + Android debug APK. iOS and store submission are explicitly out of scope — see `docs/KNOWN_ISSUES.md`. This matches the Mean Streets precedent.

## Pre-launch checks

Run these against the release-please PR before merging.

### Automated signal — every one of these must be green

| Lane | Gate | Where |
|---|---|---|
| Core | `lint`, `typecheck`, `unit tests`, `build` | `pnpm test` matrix + CI `core` job |
| Browser smoke | full `verify:browser` matrix | CI `browser` job |
| Console-clean | zero runtime exceptions / `console.error` / `console.warning` during opening-scenario play | `scripts/verify-console-clean.mjs` (T13) |
| Campaign flow | skyline-scenario victory path completes end-to-end | `scripts/verify-campaign-flow.mjs` |
| Save-compat | v1.0.1 snapshot parses cleanly through current normalizers | `tests/persistence/saveCompat.test.ts` (T14) |
| Touch targets | every primary mobile control ≥44×44 | `tests/ui/touchTargetAudit.test.ts` (T09) |
| Sandbox soak | 10k-tick seed-locked soak stable | `tests/simulation/sandboxSoak.test.ts` (T07) |
| Mobile build flow | 390×844 viewport debug-APK flow passes | `scripts/verify-mobile-build-flow.mjs` |
| Android sync | Capacitor sync completes with no missing native deps | CI `android-sync` job |
| CodeQL | actions, java-kotlin, javascript-typescript analyses clean | CI `CodeQL` jobs |

**CodeRabbit status** is informational; a "rate limit exceeded" state is not a launch blocker. Review threads raised by CodeRabbit when it was reachable **are** — every unresolved thread must be addressed before merge.

### Manual signal — visual + behavioral

These don't have automated coverage strong enough to gate launch alone. Spot-check before merging the release-please PR:

- [ ] Open `/reach-for-the-sky/` cold (hard refresh). The first-run explainer appears; dismissing it persists across reloads.
- [ ] Play three in-game days in the opening scenario. Rent, visit arrival, contract-complete, and drawer-open cues all fire and sound distinct.
- [ ] Toggle both drawers rapidly (<1s apart) a few times. No audio pool warnings surface in the browser console.
- [ ] Inspect a room, an agent, an elevator, and an empty cell. Each inspection leads with a "Because…" causal line tied to current sim state.
- [ ] Verify the mobile viewport (390×844 emulation) — drawers and cutaway pinch/pan remain usable, nothing clips below the 44×44 touch floor.
- [ ] Load a save made on the current build, then reload the page and Load it again. Funds/day/identity/rooms all restore.

Deferred visual polish is documented in `docs/KNOWN_ISSUES.md` — items on that waiver registry are **not** launch blockers.

## Artifacts the release must produce

On release-please PR merge, `release.yml` produces:

| Artifact | Destination | Verification |
|---|---|---|
| Web bundle | GitHub Pages | Visit `https://arcade-cabinet.github.io/reach-for-the-sky/` and confirm HTTP 200 |
| Android debug APK | Release asset on the `v1.0.0` tag | `gh release view v1.0.0` shows the APK |
| Version-bumped `package.json` | Commit on `main` | `grep version package.json` matches tag |
| Updated `CHANGELOG.md` | Commit on `main` | Section for `1.0.0` is present |

`cd.yml` picks up the web bundle and pushes to Pages. No manual deploy step.

## Rollback plan

If the live site regresses within one hour of deploy:

1. Re-deploy the previous Pages artifact via the GitHub Actions "Re-run" button on the last-green `cd` run on `main`.
2. Open a hotfix branch (`hotfix/<short-name>`) off the tagged commit.
3. Land the fix via a normal PR; release-please will cut `v1.0.1` on merge.

The Android APK is a release asset — players who downloaded it keep their copy. A replacement APK requires a new tag (`v1.0.1`+).

## What a successful launch looks like

- `v1.0.0` tag exists on `main`
- GitHub Release page shows the Android APK attached
- Pages site serves the new build (check build hash in the page source)
- No `console.error`/`console.warning` on a cold load of the opening scenario
- First-run explainer gates correctly for a new browser profile
- Five minutes of play produce at least one of each: agent visit, contract completion, daily report
- `docs/KNOWN_ISSUES.md` is the only doc describing unfinished work — everything else reflects shipped state

## When to cut

Green on every automated lane, green on every manual spot-check above, zero unresolved review threads on the release-please PR. Anything short of that is a no-go — hold the merge, fix the gap, re-run.
