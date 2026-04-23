# Reach for the Sky

A standalone Solid + PixiJS vertical cutaway skyscraper simulator.

## Creative Pillars

- Readable living tower: rooms, agents, elevators, dirt, contracts, city pressure, and revenue must be understandable at a glance.
- Vertical ambition: every placement should make the tower feel taller and more operationally complex.
- Operational pressure: elevator routing, tenant schedules, maintenance, contracts, public events, and rent collection create the core decisions.
- Cinematic skyline second: depth, weather, and sky treatment elevate the experience without obscuring the cutaway simulation.
- Touch-first viability: construction drag, pan, zoom, lenses, save/load, and HUD controls must work on desktop and mobile.

## Current Stack

- SolidJS app shell and HUD
- PixiJS v8 main cutaway renderer
- optional raw Three.js sky/depth renderer
- Koota trait state only
- Yuka graph/A* navigation for simulation agent routing
- Capacitor 8 app shell
- `@capacitor-community/sqlite` + `jeep-sqlite` + `sql.js` save persistence
- `@capacitor/preferences` granular UI/settings persistence
- Tone.js procedural audio and Howler.js generated `.ogg` sample-sprite playback
- Vite, pnpm, TypeScript, Biome, Vitest

Keep `sql.js` pinned to `1.11.0` while using `jeep-sqlite@2.8.0`; the web component's WASM loader expects that ABI.

Android hardware Back belongs to the native game shell. It should close Settings, close Contracts, or pause an active run into Settings before falling through to browser history or minimizing the app.

## Implementation Notes

The 2D POC remains the gameplay blueprint. The 3D POC informs atmosphere and skyline/depth, but the primary player interaction is a Pixi-rendered cutaway tower. Solid should observe selected Koota slices for HUD and panels; Pixi should consume compact simulation snapshots and avoid high-volume reactive room or agent components.

Tenant sentiment ties the first operating loops together. Transit pressure, service pressure, and cleanliness lower sentiment; sentiment lowers rent efficiency at midnight. Expansion without elevator/service planning should therefore create visible flow problems and direct economic leakage.

The game spine now runs as macro, meso, and micro state:

- Macro state: district identity, market cycle, public trust, business/residential/tourism demand, regulation, weather risk, fame, civic pressure, scandal risk, city influence, and skyline status.
- Meso operations: floor count, height risk, transit topology, service coverage, venue credibility, safety readiness, privacy, noise control, event readiness, revenue health, operational grade, and floor-band pressure.
- Micro simulation: Yuka-routed workers, guests, janitors, and visitor representatives with personality/goal pressure feeding visible queues, service load, cohort outcomes, and reputation.

Campaign progression is now contract-driven. Act contracts define the beginning-to-end player journey from empty lot to working tower, declared district identity, public landmark, and skyline institution. Reactive contracts emerge from simulation pressure, such as bad transit, sanitation collapse, and public visits, rather than from fixed milestone scripts. Contracts expose live score and pressure values, so deadlines, rewards, penalties, and partial progress create visible tradeoffs instead of a hidden pass/fail checklist. Incomplete objectives expose objective diagnostics with the relevant lens, build recommendation, and focus inspection when a concrete location exists. Failed pressure contracts spawn recovery contracts with trust rewards, giving the player an explicit repair path after public mistakes.

Act 3 is an explicit player specialization choice. The tower can be declared as a business hub, vertical village, event destination, civic tower, prestige tower, or mixed ecosystem. The declaration shapes macro demand and public positioning, while the derived tower identity still exposes whether the built meso layout supports that promise.

The skyline-charter scenario is the deterministic campaign proof. It drives the same systems through all five acts, completes the skyline institution mandate, grants the skyline charter, and leaves the tower in campaign-backed sandbox mode with an active rotating city-cycle mandate. Sandbox mandates are generated from current weather, transit, trust, and civic-calendar pressure, and each requires another successful public outcome so the endgame keeps producing playable city obligations.

Daily reports are the long-loop digest. They summarize revenue, operating costs, net yield, queue pressure, dirt burden, sentiment, service, public trust, fame, tower identity, reputation movement, notable operating stories, and next risks so the player understands why tomorrow's construction matters.

Elevator pressure should remain queue-driven. Agents accumulate wait ticks, blocked Yuka routes stay visibly stalled, and cars dispatch toward the longest-waiting requester so transit bottlenecks can be reasoned about from the cutaway.

Visitor cohorts should be generated from archetype trait vectors, not milestone checklists. Celebrity entourages, political delegations, foreign princes, press swarms, city inspectors, monks, school teachers, labor groups, trade buyers, and stamp collectors should be biased by tower identity, fame, trust, venue mix, regulation/scandal/weather pressure, and current operations. They then react through shared pressures like queues, cleanliness, privacy, noise, status sensitivity, patience, spending power, safety readiness, weather exposure, and group cohesion. Due inquiries should become routed representative visitor agents, not just notifications; those representatives derive Yuka goal personalities from cohort traits, arbitrate venue goals through Yuka evaluators, and should pay/complain through the same systemic pressures as everyone else. The same trait vectors should produce player-facing behavior profiles with temperament, group dynamic, spending signal, values, and dealbreakers, so public hosting feels like reading people rather than solving a fixed VIP checklist. A Yuka `Think` + `GoalEvaluator` hosting planner should rank concrete preparations from those same traits and live tower pressures, so the player sees why a foreign prince currently prioritizes privacy/safety while stamp collectors prioritize quiet buffers. Durable visit memories should keep structured pressure reasons and surface them with the remembered profile as public-pressure badges so the player can see why a group praised, tolerated, or complained about the tower. The latest story should also expose the dominant bottleneck, current metric, direct lens action, and inspection focus, so public complaints become diagnosable play rather than flavor text. Complaints and harsh mixed memories should generate targeted public-memory repair contracts, converting micro stories into meso corrective objectives and macro trust stakes.

Public hosting needs player agency. The Contracts drawer can invite a public visit when the tower has a credible venue, but it must forecast the decision before committing: likely cohort, venue, arrival time, friction score, pressure reasons, and what to fix first. After commitment, the visit docket must show the active obligation separately from the next-invite forecast: phase, representative count, venue, current story risk, and what to protect before departure. The committed invite should create a normal cohort inquiry rather than bypassing simulation: arrival, Yuka routing, spending, memory, and outcome still flow through the same systems as generated visits.

Keep the primary playfield open. The top HUD is for live informatics, including active visit count; the named left drawer owns contracts, city brief, public pressure, operations, daily reports, permit progress, and visit docket; the named right drawer owns settings, save/load, audio, accessibility, and secondary operations.

Click/tap inspection is part of the player explanation layer. Inspecting a room, agent, elevator, or empty bay should tell the player what it is, why it matters, and which pressures are currently affecting it.

Durable game truth belongs in SQLite saves/events. Save slots are first-class campaign surfaces: Autosave, Campaign A, Campaign B, and Sandbox each show act/day/identity/funds summaries and can be selected from Settings or the start screen. Autosave is the default continue path and writes after meaningful progression events such as construction, identity declaration, daily reports, public visits, contract outcomes, milestones, and victory. Simulation history is stored as queryable event rows for build, rent, daily report, visit, contract, milestone, and victory outcomes so future diagnostics/replay tools do not have to parse whole save blobs. Preferences are only for lightweight state such as lens mode, camera defaults, audio volume, accessibility flags, tutorial progress, and HUD options.

## Visual Guardrails

This is a 2D cutaway, not a flat-color block diagram. Use a restrained architectural palette for room bodies, and differentiate spaces with mullions, furnishings, lighting behavior, dirt, signage, and lens overlays. Bright colors should be rare and functional: construction validity, service failures, transit pressure, tutorial focus, or monetary feedback.

Use authored SVG composites and reusable element assets in `public/assets/vectors` for precise room and core details. Primitive Pixi shapes are appropriate for shells, masks, overlays, and data visualization; they should not be the main vocabulary for furniture, mullions, signs, or architectural interiors.

Treat SVG structure as its own gameplay readability layer. Facade ribs, slabs, ceiling rails, dividers, and panels should make the tower feel engineered and continuous across room types, while room-specific assets should add function and personality without becoming loud iconography.

Dynamic actors should also stay authored. Workers, guests, janitors, visitors, and waiting markers use `public/assets/vectors/agents` so player attention is drawn to purposeful silhouettes instead of generic dots.

Expanded room families must stay in the same authored language. Utilities, restrooms, security, mechanical rooms, event halls, retail, sky gardens, observation decks, conference rooms, clinics, galleries, luxury suites, and weather cores are composed from SVG element assets in `public/assets/vectors/elements`, not primary-color placeholder rectangles.

## Rendering Contract

Normal-mode tower base art is cached behind deterministic render signatures. Room layout, room seeds, shafts, lighting hour, and occupied-room changes invalidate the base; dirt, agents, elevators, particles, clouds, and build previews remain dynamic overlays. Keep future visual work inside this split unless a feature explicitly needs per-frame room-base changes.

During dev runs, `window.reachForTheSkyRenderer.getStats()` can be used from the browser console to verify that normal play produces cache hits instead of rebuilding the room base every frame.

Use `pnpm verify:render-stats` as the browser smoke check for this contract. It launches the opening scenario through headless Chrome and asserts that normal-mode rendering records cache hits.

Use `pnpm verify:build-flow` as the browser smoke check for player construction. It clicks through the app, drags on the Pixi viewport, commits lobby/floor/office/elevator construction, and confirms maintenance, transit, sentiment, privacy, safety, and event data lens rendering.

Use `pnpm verify:campaign-flow` as the browser smoke check for the complete player journey. It opens the skyline-charter scenario and asserts that every act contract is completed, the skyline charter and sandbox-city-cycle are unlocked, an active sandbox city-cycle mandate is visible, and the victory state is visible in the UI.

Use `pnpm verify:mobile-build-flow` as the touch-input smoke check. It runs Chrome mobile emulation, dispatches touch drags against the Pixi viewport, and confirms mobile lobby/floor/office construction.

Use `pnpm verify:save-load` as the browser smoke check for persistence. It launches the opening scenario, selects Campaign A, writes through the app Save control into Capacitor SQLite's web fallback, verifies the slot summary, resets the app, and restores the snapshot through Load.

Use `pnpm verify:corrupt-save` as the browser smoke check for corrupted-save recovery. It injects an invalid SQLite save row, verifies quarantine, checks the Settings diagnostics recovery surface, and clears the quarantine entry through the UI.

Use `pnpm verify:preferences` as the browser smoke check for lightweight KV state. It writes lens mode through Capacitor Preferences, reloads, starts a fresh game, and verifies that the lens is restored.

Use `pnpm verify:report-loop` as the browser smoke check for the day-loop digest. It advances the opening scenario through a real midnight tick loop, verifies rent and daily-report events, asserts those rows land in SQLite simulation history, asserts Autosave contains the report-bearing snapshot, and confirms the generated report appears in the Contracts drawer.

Use `pnpm verify:public-memory` as the browser smoke check for the public-story explanation layer. It opens the skyline-charter scenario, verifies structured pressure reasons on durable memories, checks that the top HUD, public-pressure card, latest-public-story diagnosis/action panel, and memory badges expose those reasons to the player, and asserts that the panel lens and inspection actions change Koota view/inspection state with public-story context attached.

Use `pnpm verify:memory-repair` as the browser smoke check for public-memory recovery. It opens the recovery scenario and verifies that a complaint memory creates a targeted contract with concrete pressure objectives, objective diagnostics, lens/build actions, and a follow-up successful-visit requirement.

Use `pnpm verify:invite-visit` as the browser smoke check for intentional public hosting. It opens the recovery scenario, verifies the forecast card is visible, clicks Invite Public Visit, and verifies a real cohort inquiry, active-commitment readout, reactive hosting contract, SQLite event row, and autosaved pending visit.

Use `pnpm verify:visit-lifecycle` as the browser smoke check for the full public hosting loop. It opens the recovery scenario, commits an invite, advances the live simulation through arrival, representative routing, spend, departure, latest-public-story UI, durable public memory, contract/reputation events, SQLite history, and autosaved memory state.

Use `pnpm verify:menu-scenarios` as the browser smoke check for the start of the player journey. It verifies that scenario shortcuts render as preview-backed cards rather than debug-style buttons.

Use `pnpm verify:audio-assets` as the browser smoke check for sourced cue playback. It fetches and decodes the generated Howler OGG sprite and verifies that the configured cue windows fit the shipped asset.

Use `pnpm verify:app-metadata` as the install-surface smoke check. It validates the manifest, app icons, committed preview screenshots, social preview image metadata, and Android launcher resources.

Use `pnpm verify:browser` for the full browser/app verifier sequence and `pnpm verify:release` for the production gate: lint, typecheck, unit tests, build, all browser verifiers, screenshots, and Android Capacitor sync.

Settings are part of the simulation shell, not a separate store. Tone.js procedural volume, Howler sample volume, mute, high-contrast mode, and reduced-motion mode live in Koota `SettingsTrait` and persist through Capacitor Preferences. Howler loads `public/assets/audio/reach-ui-cues.ogg` as a cue sprite for construction, rent, warnings, elevator accents, and milestones; Tone remains the deterministic fallback.

Simulation randomness must remain stateful and persisted. The clock snapshot carries RNG state, and room visual seeds are derived from stable placement geometry; do not use raw `Math.random()` for gameplay, actors, or authored visual variation.

Use `pnpm capture:screenshots` after visible renderer or HUD changes. It captures the start menu, desktop/mobile opening-scenario screenshots, the named left/right drawers, daily-report UI, construction ghost, maintenance/transit/value/sentiment/privacy/safety/event lenses, inspection, skyline-victory, public-memory, weather-stress, recovery-contract, invited-visit, and resolved visit-lifecycle states into `test-screenshots/`.
