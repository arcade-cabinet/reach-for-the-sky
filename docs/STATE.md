---
title: State
updated: 2026-04-24
status: current
domain: context
---

# Reach for the Sky — Current State

## Where We Are

`main` contains the standalone production runtime, the polished landing and HUD surfaces, GitHub Pages deployment, Android debug CI packaging, and the five-act campaign-backed sandbox spine. Web lane and Android debug artifact lane are both green.

Current public web surface as of 2026-04-24:

- GitHub Pages live on v1.1.6
- production landing page deployed with current scenario previews
- release and CD lanes green on every merged commit in the 1.1.x line
- Android AAB published per tagged release as a GitHub Actions artifact

## Repository Reality

The project is a standalone game repo with:

- its own CI/CD (ci / release / cd lanes)
- release-please tag automation
- its own Capacitor shell
- its own docs surface
- 152 passing tests across unit, UI, and browser-persistence layers

## What Is Stable

- build/run/test toolchain
- campaign proof spine
- persistence and diagnostics surface
- browser verifier matrix (save-load, corrupt recovery, preferences, report loop, public memory, invite visit, visit lifecycle)
- deploy pipeline
- HUD + drawer polish: tone-graded percentages across HUD / City Brief / Journey / Operations / Daily Report / build-readout / public story / memory card / history counts
- label humanization: no raw kebab-case enums surface to players
- a11y affordances on speed controls, drawer toggles, and Reset confirmation
- CDP harness auto-accepts dialogs so verifiers never deadlock on blocking prompts

## What Is Not Finished

- content breadth
- late-game authored depth
- iOS release readiness
- store-submission asset/checklist flow
- complete SVG art coverage for every room/agent/event surface

## Immediate Next Work Themes

- content breadth and authored differentiation
- late-game pacing and authored campaign depth
- platform/store readiness (iOS + Play Store)
- continued SVG authoring to cover remaining room and agent families
