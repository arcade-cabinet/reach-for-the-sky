---
title: Release Runbook
updated: 2026-04-23
status: current
domain: ops
---

# Reach for the Sky — Release Runbook

This document owns the release procedure.

## Automated Paths

- PRs run `.github/workflows/ci.yml`
- `main` runs `.github/workflows/release.yml`
- `main` also runs `.github/workflows/cd.yml`
- `.github/workflows/automerge.yml` only handles Dependabot and release-please PRs

## Daily Feature Shipping Flow

1. create a feature branch
2. make changes
3. run relevant local gates
4. push branch
5. open PR
6. address review feedback
7. wait for green checks
8. squash merge
9. verify main CD and Pages deployment

## Local Gates For Documentation-Oriented Work

At minimum:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For product/UI changes, also run:

```bash
pnpm verify:browser
pnpm capture:screenshots
```

## Post-Merge Verification

After merge to `main`, confirm:

- Release workflow completed
- CD workflow completed
- Pages deploy completed
- live site returns HTTP 200

## Current Release Reality

The repo is already wired for continuous web deployment. Android debug packaging is automated. A full store-submission runbook for Android/iOS beyond debug artifacts is still future work.
