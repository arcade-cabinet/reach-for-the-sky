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

## Current Verification Debt

- no dedicated physical-device manual QA checklist in this repo yet
- no separate long-run performance soak test lane
- no browser automation for every tower identity branch yet
- no app-store submission checklist yet
