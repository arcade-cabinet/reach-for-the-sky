---
title: Browser Test Coverage Plan
updated: 2026-04-24
status: current
domain: quality
---

<!-- 40 tests across 6 files in real Chromium; last run 10:58:46 local. -->


# Browser Test Coverage Plan

This directory holds vitest browser-mode tests — real Chromium via playwright,
real Solid render, real DOM events. The plan below enumerates every player-
visible surface and its coverage status so new phases have an obvious home.

## Legend

- ✅ covered with browser-level tests
- ⬜ queued, not yet landed
- 🔲 intentionally out of scope for browser mode (covered elsewhere)

## Journey phases

### 1. Landing (`StartScreen`) — ✅ `StartScreen.browser.test.tsx`
- ✅ Break Ground + Continue Tower render
- ✅ Continue Tower disabled when no saves
- ✅ Continue Tower enabled with at least one save
- ✅ Break Ground click fires `onStart`
- ✅ Scenario cards render img + title + description
- ✅ Save-slot radiogroup semantics (role / aria-checked)
- ✅ Scenario card click fires `onScenario(id)` for each of 4 scenarios
- ✅ Save-slot click calls `onSelectSaveSlot` with slot id
- ✅ Platform label + start-notice surface (live region)

### 2. First-run (`FirstRunExplainer`) — ✅ `FirstRunExplainer.browser.test.tsx`
- ✅ Hidden under `navigator.webdriver === true`
- ✅ Hidden under `?scenario=...` deep-link
- ✅ Hidden under `?skip-intro=1`
- ✅ Shows for fresh player, advances through 3 steps
- ✅ Escape closes
- ✅ Skip closes
- ✅ role=dialog + aria-modal + aria-labelledby
- ⬜ Focus trap: Tab cycles within card, never escapes to HUD
- ⬜ ArrowLeft returns to previous step (step > 0 only)
- ⬜ preferences.set(firstRunSeen, '1') on finish

### 3. HUD — ✅ `App.scenario.browser.test.tsx`
- ✅ Top-hud carries aria-label="Game HUD and controls"
- ✅ Speed controls carry aria-pressed reflecting clock.speed
- ✅ Contracts button aria-label swaps Open/Close with state + aria-expanded
- ✅ Settings button aria-label swaps Open/Close with state (covered in settings suite)
- ✅ Notifications section is aria-live=polite with aria-label
- ✅ Reset button carries full aria-label
- ⬜ Funds cell carries title with full precision money string (jsdom-friendly, can be promoted)
- ⬜ Mobile speed-row appears only under narrow viewport emulation
- ⬜ Tone-graded metric classes resolve to expected computed colors

### 4. Build flow — ✅ `App.interaction.browser.test.tsx`
- ✅ Toolbar labels itself + every button carries aria-pressed + cost-bearing aria-label
- ✅ Tool click: at-most-one aria-pressed invariant holds across 3 sequential clicks
- ✅ Build-readout title reflects selection state and swaps with tool picks
- ⬜ Build-readout shows preview.cost when valid and preview.error when invalid (requires canvas drag)
- 🔲 Canvas drag → commit (Pixi integration — covered by CDP verifier)
- 🔲 Particles + tone-good/bad cost animation (visual only)

### 5. Lens swap — ✅ `App.scenario.browser.test.tsx` + `App.interaction.browser.test.tsx`
- ✅ Lens-panel has aria-label="Diagnostic lenses"
- ✅ All 8 lens buttons render with aria-pressed; exactly one is "true"
- ✅ Click flips aria-pressed exclusively (Maintenance click → it becomes the sole pressed)
- ⬜ `canvas-host` background switches off sky gradient in non-normal lenses

### 6. Inspection — ⬜ `Inspection.browser.test.tsx`
- ⬜ Inspection card hidden when no selection
- ⬜ Close button clears inspection
- ⬜ Escape clears inspection when no drawer open
- ⬜ aria-label on close button

### 7. Contracts drawer — ✅ `App.contracts.browser.test.tsx` + `App.scenario.browser.test.tsx`
- ✅ aria-hidden=true when closed
- ✅ aria-label="Contracts drawer"
- ✅ Escape closes when open (toggle flips aria-hidden back)
- ✅ Identity buttons form a radiogroup with aria-checked on each
- ✅ Identity buttons enabled at Act 5 (skyline scenario)

### 8. Settings drawer — ✅ `App.settings.browser.test.tsx`
- ✅ Opens on button click; aria-label / aria-expanded / drawer aria-hidden update
- ✅ Every toggle carries aria-pressed
- ✅ Audio sliders carry aria-valuetext formatted as "N percent"
- ✅ Slider numeric readout AND aria-valuetext update live on input event
- ✅ Save-slot list is role=radiogroup with exactly one aria-checked=true
- ⬜ Corrupt-save Forget button slot-specific aria-label (requires fixture with corrupt saves)
- ⬜ Export Debug Bundle triggers a download + announces via save-notice live region

### 9. Day loop — 🔲
- 🔲 Tick → autosave → daily report (covered by CDP verifier)

### 10. Reset flow — ✅ `App.interaction.browser.test.tsx`
- ✅ Reset button has a full aria-label
- ⬜ `shouldRunDestructive` bypass when webdriver=true (unit-covered already)
- 🔲 Confirm() flow — jsdom and unit tests cover `shouldRunDestructive` directly

### 11. Visual regression — ⬜ `visual/*.test.tsx`
- ⬜ Snapshot StartScreen desktop + mobile viewport
- ⬜ Snapshot contracts drawer with each act's authored content
- ⬜ Tone classes resolve to expected CSS (`getComputedStyle` check for tone-good/mid/bad)
- ⬜ High-contrast + prefers-contrast: more lift the eyebrow color
- 🔲 Full scenario screenshot parity — already handled by capture-screenshots.mjs

## Out of scope for vitest browser

- **Pixi render correctness** — covered by `verify:render-stats` CDP script because Pixi's WebGL + stage mutation doesn't fit a test-library assertion model.
- **Full save-load round-trip across refresh** — covered by `verify:save-load` CDP script because vitest browser mode doesn't survive reload.
- **Capacitor native APIs on Android** — covered by actual Android debug APK install + manual smoke.

## How to add a new file

1. Name it `<Surface>.browser.test.tsx`
2. Import components via `@app/...` alias
3. Override `navigator.webdriver = false` if the component gates on automation
4. Use `@solidjs/testing-library` `render` for components, or mount `<App />` for coordination tests
5. Assert on live DOM attributes (`aria-checked`, `aria-pressed`, `.disabled`, `.title`) — do **not** assert on the TSX source
6. Check off the ⬜ above, update `status` date
