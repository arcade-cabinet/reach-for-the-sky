---
title: Testing
updated: 2026-04-23
status: current
domain: quality
---

# Reach for the Sky — Testing

This document owns the test strategy and verification lanes.

## Core Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Browser Verification

```bash
pnpm verify:browser
```

Includes:

- render stats
- build flow
- campaign flow
- mobile build flow
- save/load
- corrupt-save recovery
- preferences persistence
- report loop
- public memory
- memory repair
- invite visit
- visit lifecycle
- menu scenarios
- audio asset validation
- app metadata validation

## Release Gate

```bash
pnpm verify:release
```

Includes:

- lint
- typecheck
- unit tests
- build
- browser verification suite
- screenshot capture
- Android Capacitor sync

## Screenshot Capture

```bash
pnpm capture:screenshots
```

Use after meaningful HUD, rendering, drawer, or scenario changes.

## Mobile + Touch QA (T09)

### Touch-target audit

`tests/ui/touchTargetAudit.test.ts` parses `app/styles/global.css` and computes effective hit width/height for every primary mobile tap selector. Minimum is 44×44 (WCAG AA target size). Any selector below the floor fails CI until fixed. Selectors audited:

- `.side-button`
- `.tool-button`
- `.speed-row button` / `.save-row button` / `.lens-panel button` / `.settings-toggles button`
- `.drawer-head button`
- `.start-actions button`

Fixes landed in T09: five controls were below 44px (32–40px effective height). All now carry `min-height: 44px` (and `min-width: 44px` for the circular pill buttons).

### Device matrix checklist

Manual QA runs against the Android debug APK produced by `ci.yml`:

| Form factor | Reference device | Primary check |
|---|---|---|
| Compact phone | Pixel 5 or equivalent (6.0″, 1080×2340) | drawer reachability, cutaway readability at default zoom |
| Standard phone | Pixel 8 or equivalent (6.2″, 1080×2400) | contracts drawer, inspection panels, settings toggles |
| Large phone / foldable | Pixel 8 Pro / Fold (6.7″ / 7.6″) | HUD layout, cutaway gesture handling |

### Perf budget on mid-tier Android

Reference device for the 60fps p50 budget: **Pixel 5 / Snapdragon 765G / 8 GB RAM**. Targets:

- 60fps p50 during steady sandbox play with ≥20 visible agents
- No sustained dropped-frame cluster ≥10 frames during a 3-cohort convention visit
- APK cold-start to playable ≤4s on the reference device
- Memory footprint ≤180 MB after 10 minutes of sandbox play

Run `pnpm cap:sync:android` then install the resulting debug APK. Perf measurement via Android Studio Profiler (CPU + memory traces).

### Signoff

| Lane | Status | Evidence |
|---|---|---|
| Automated touch-target audit | green (T09) | `tests/ui/touchTargetAudit.test.ts` |
| Programmatic CSS mobile sizing | green (T09) | 5 controls raised to ≥44×44 |
| Manual device matrix | pending | physical-device test run on debug APK |
| Perf budget on reference device | pending | Android Studio Profiler trace |

## Current Verification Debt

- manual physical-device QA still pending (automated audit closes the CSS side only)
- perf profile traces not yet captured on the reference device
- no separate long-run performance soak test lane (partial: 10k-tick sandbox soak lives in `tests/simulation/sandboxSoak.test.ts`)
- no browser automation for every tower identity branch yet
- no app-store submission checklist yet
