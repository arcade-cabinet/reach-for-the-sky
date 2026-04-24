---
title: PR #122 Follow-ups (browser tests + memory audit)
updated: 2026-04-24
status: current
domain: context
---

# PR #122 Follow-ups

## Context

PR #122 — branch `test/vitest-browser-mode` — landed three things:

1. **vitest browser project** — 34 real-Chromium component tests via
   `@solidjs/testing-library` + `@vitest/browser-playwright`.
2. **Playwright e2e suite** — 14 tests covering the full player journey
   (smoke, gameplay, build-commit) with viewport screenshots attached
   to the HTML report.
3. **7 memory-leak fixes** from an audit triggered by a dev-session
   memory spike (audio-engine destroy, per-frame Pixi destroy-and-clear,
   agent cap, debug-hook guard, timer cleanup, texture-cache reset,
   camera-pref debounce, mobile Playwright projects opt-in).

The PR was squash-merged after addressing the high-value subset of
CodeRabbit's review feedback. The items below are the ones explicitly
**deferred** — either because they required a test-run session the user
wanted to skip, or because they are sized as distinct follow-up work.

## State at handoff

Branch `test/vitest-browser-mode` was squash-merged into `main` on
2026-04-24. All work below should be done on fresh branches off `main`.

Current test counts:
- **Unit**: 154 tests in 31 files (vitest, jsdom) — all green locally.
- **Browser (vitest)**: 40 tests in 7 files (Chromium via playwright
  provider) — status at handoff unknown; do NOT assume green, verify.
- **E2E (Playwright)**: 14 tests in 3 files (smoke.spec.ts,
  gameplay.spec.ts, build.spec.ts) — last verified green 2026-04-24
  headed on macOS.

## Tasks

### T1 — Wait-for-state instead of fixed timeouts (CodeRabbit)

**File**: `tests/browser/App.scenario.browser.test.tsx` around line 128-135.

Replace the 40ms `setTimeout` after `contractsBtn?.click()` with
`@solidjs/testing-library`'s async utilities. Use a `waitFor` (there is
already a `waitFor(predicate, {timeout, interval})` helper pattern
duplicated across four browser test files — see T4 for the extraction)
that polls until `contractsBtn.getAttribute('aria-expanded') === 'true'`
AND `aside.contracts-drawer[aria-hidden=false]` is present before
asserting.

Why: fixed sleeps are flaky under CI load. State-based waits settle as
soon as the reactive system has caught up.

Acceptance: no `setTimeout(resolve, NN)` patterns remain in
`App.scenario.browser.test.tsx` where a DOM-state assertion follows.

### T2 — Focus-trap test for FirstRunExplainer (Phase 2 coverage gap)

**File**: `tests/browser/FirstRunExplainer.browser.test.tsx` (new test).

`tests/browser/COVERAGE.md` flags three open Phase-2 items:

- `⬜ Focus trap: Tab cycles within card, never escapes to HUD`
- `⬜ ArrowLeft returns to previous step (step > 0 only)`
- `⬜ preferences.set(firstRunSeen, '1') on finish`

Add tests for each. The focus-trap test dispatches `Tab` + `Shift+Tab`
key events and asserts `document.activeElement` stays inside
`.first-run-card`. ArrowLeft: dispatch the key, assert the step title
changes back. preferences.set: spy on `@capacitor/preferences` via the
same mocking pattern already used in unit tests, assert
`PREF_KEYS.firstRunSeen` is written `'1'` on the final step's primary
button click.

Acceptance: `FirstRunExplainer.browser.test.tsx` has 3 new tests
passing, those 3 ⬜ rows in `COVERAGE.md` flip to ✅.

### T3 — Preview-error assertion in build.spec.ts (CodeRabbit)

**File**: `e2e/build.spec.ts:103-129` — the "build readout shows
preview.error when the current drag is invalid" test.

Currently the test only asserts that funds didn't change and the readout
is still visible. It doesn't actually prove the readout entered an
error state. Extend to assert the readout carries the error-signaling
class/child or contains the expected error string
("Floors need a floor or lobby directly beneath", etc.).

Option A — class check:
```ts
await expect(readout).toHaveClass(/(error|invalid)/);
```

Option B — child element:
```ts
await expect(readout.locator('.preview-error, .build-readout-error')).toBeVisible();
```

Read `app/App.tsx` build-readout JSX first to see which signaling
approach is actually used; neither selector above is guaranteed to
exist. If the readout currently has no error-state class, add one in
the same PR — this is a legitimate missing UI affordance, not just a
test concern.

Acceptance: the Office-mid-air test fails loudly if the error readout
regresses.

### T4 — Extract shared `waitFor` helper (CodeRabbit)

**File**: new `tests/browser/helpers.ts`, imports into 4+ existing
browser test files.

The helper is duplicated verbatim in:

- `tests/browser/App.contracts.browser.test.tsx`
- `tests/browser/App.settings.browser.test.tsx`
- `tests/browser/App.scenario.browser.test.tsx`
- `tests/browser/App.interaction.browser.test.tsx`
- `tests/browser/visual.tone.browser.test.tsx`

All five copies have identical signatures:

```ts
async function waitFor(
  predicate: () => boolean,
  { timeout = 4000, interval = 50 }: { timeout?: number; interval?: number } = {},
): Promise<void>
```

Extract once, import everywhere. While you're there:

- Export an `openSettings(container)` / `openContracts(container)`
  helper — those button-finding utilities are also duplicated.
- Export an `overrideWebdriver(value: boolean)` helper for
  FirstRunExplainer-style tests.

Acceptance: browser tests import the helper from a single module; the
inline copies are deleted.

### T5 — Visual-regression `--text-muted` lift test hardening (CodeRabbit)

**File**: `tests/browser/visual.tone.browser.test.tsx:99-107`.

The "high-contrast lift" test currently conditionally skips when no
selector matches or when the color doesn't equal the lifted value.
That's a silent pass for a regression. Fix: explicitly assert the
selector finds an element and explicitly assert the lifted color.

If there's no element with `color: var(--text-muted)` visibly under
`.app-shell.high-contrast`, that's a real test-setup bug — either the
probe needs to live inside `.app-shell` or the selector needs
adjusting. Don't paper over it with conditional expects.

Acceptance: the test either asserts `liftedColor === rgb(212, 228,
237)` unconditionally or is rewritten to target an element that reliably
resolves the high-contrast variable.

### T6 — `afterEach(cleanup)` in browser tests (audit F5 follow-on)

**Files**: every `tests/browser/*.browser.test.tsx` that mounts
`<App />`.

The memory audit flagged that browser tests which remount `<App />`
between cases without calling `cleanup()` (from
`@solidjs/testing-library`) trigger the new "debug hook already present"
warning logged in `app/components/GameCanvas.tsx:75-85`. That warning
is deliberate — it means a prior instance leaked a renderer/WebGL
context.

The fix is to call `cleanup()` in `afterEach` of every browser test
file that mounts `<App />`:

```ts
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach } from 'vitest';
afterEach(cleanup);
```

Acceptance: running `pnpm test:browser` produces zero
"debug hooks still present" console warnings.

### T7 — FirstRunExplainer copy coupling (CodeRabbit)

**File**: `tests/browser/FirstRunExplainer.browser.test.tsx:59-87`.

Tests currently assert exact step titles ("A living tower", "Read the
cutaway", "Declare who the tower is"). These are fragile — every copy
tweak breaks them.

Either: (a) capture the initial title text and assert later steps
produce DIFFERENT non-empty titles, or (b) add an explicit comment
stating the strings are authoritative and should be updated in lockstep.

Prefer (a) — tests shouldn't be the reason a designer can't tweak a
tutorial line.

### T8 — Identity-buttons presence (CodeRabbit)

**File**: `tests/browser/App.contracts.browser.test.tsx:44-62`.

The current test wraps the radiogroup assertions in
`if (group) { ... }`, so if `.identity-buttons` disappears the test
silently passes. Replace with `expect(group).not.toBeNull()` (or split
into two tests — one asserting presence in late acts, one skipping or
explicitly asserting absence in early acts).

### T9 — README.md / CHANGELOG.md update for memory-audit changes

The 7 memory-leak fixes touched public-facing behavior in subtle ways
(e.g. agent cap now enforced, camera preferences debounced). Add a
note under CHANGELOG.md for the next release cut describing the
perf improvements under the version line that absorbs this merge.

## Non-goals (explicitly deferred further)

- **Full conversion to Pixi object pooling** (audit F2 long-term). The
  destroy-and-clear fix in PR #122 stops the GPU-buffer leak; converting
  to pools would eliminate the allocations entirely but is a separate
  perf pass, not a leak fix.
- **Renderer memory-budget metric in `RenderStats`** (audit long-term
  recommendation). Nice-to-have diagnostic, not urgent.
- **Capture-screenshots.mjs modernization** — the CD script is separate
  from the Playwright e2e suite and still works; harmonizing them is
  its own feature.

## If you're blocked

- If CI is flaky on the e2e suite, check that the vite dev server's
  `--strictPort` flag didn't land alongside an actual port collision —
  run `lsof -iTCP:41741` locally to check.
- If the debug-hook warning keeps firing in browser tests, check that
  `cleanup()` imports from `@solidjs/testing-library` (not
  `@testing-library/jest-dom`).
- If Tone.js errors appear after the audio-destroy change, the release
  path in `SkyAudioEngine.destroy()` may be racing with an in-flight
  `triggerAttackRelease`. Add a `try/catch` around each node dispose
  (we already do for triggerRelease).
