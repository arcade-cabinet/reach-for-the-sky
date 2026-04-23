# Reach for the Sky

Reach for the Sky is now a standalone Solid + PixiJS vertical cutaway skyscraper simulator. The gameplay model follows the 2D POC: readable tower construction, tenant movement, elevator pressure, dirt/service loops, daily rent, campaign contracts, macro city pressure, and act-based progression. Three.js is kept as an optional depth/sky composition layer, not the main interaction surface.

## Architecture

- `app/`: Solid app shell, HUD, controls, styles, and the Pixi canvas host.
- `src/simulation/`: pure placement, time, economy, campaign, macro, operations, agent, elevator, dirt, visitor, and contract systems.
- `src/state/`: Koota trait world, actions, and Solid subscription helpers.
- `src/rendering/`: PixiJS cutaway renderer plus optional raw Three.js sky/depth renderer.
- `src/persistence/`: Capacitor SQLite save/event storage and Capacitor Preferences KV wrappers.
- `src/audio/`: Tone.js procedural cues and Howler.js sourced sample playback hooks.
- `public/assets/`: static runtime assets, authored SVG vectors, generated Howler OGG cue sprites, and `sql-wasm.wasm` for the SQLite web fallback.
- `tests/`: unit coverage for placement, campaign progression, simulation ticking, persistence serialization, vector composition, and Preferences wrappers.

## Runtime Stack

- pnpm, Vite, TypeScript, Biome, Vitest
- SolidJS with `vite-plugin-solid`
- PixiJS v8 for the high-volume cutaway renderer
- optional raw Three.js sky/depth renderer following the Pixi/Three shared-rendering direction
- Koota traits/entities for game state, with no Zustand
- Yuka graph/A* navigation for simulation agent routing
- `@capacitor-community/sqlite`, `jeep-sqlite`, and `sql.js` for durable saves and web fallback
- `@capacitor/preferences` for lightweight UI/settings KV state
- Tone.js for procedural audio and Howler.js for `.ogg` sample-sprite playback

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm verify:render-stats
pnpm verify:build-flow
pnpm verify:campaign-flow
pnpm verify:mobile-build-flow
pnpm verify:save-load
pnpm verify:corrupt-save
pnpm verify:preferences
pnpm verify:report-loop
pnpm verify:public-memory
pnpm verify:memory-repair
pnpm verify:invite-visit
pnpm verify:menu-scenarios
pnpm verify:audio-assets
pnpm verify:app-metadata
pnpm verify:visit-lifecycle
pnpm verify:browser
pnpm capture:screenshots
pnpm build
pnpm exec cap sync android
pnpm verify:release
```

`pnpm build` copies `node_modules/sql.js/dist/sql-wasm.wasm` to `public/assets/sql-wasm.wasm` before typechecking and bundling. Keep `sql.js` pinned to `1.11.0`; `jeep-sqlite@2.8.0` expects that WASM ABI and newer `sql.js` binaries fail in the browser web store.

Android hardware Back is treated as part of the game shell: it closes the right Settings drawer first, then the left Contracts drawer, pauses an active run into Settings, and only falls through to web history or app minimize when no in-game panel needs handling.

## Game Direction

The player experience should stay simulation-first: a clear vertical cutaway tower where construction decisions visibly affect daily flow. Cinematic skyline, sky depth, weather, and atmosphere should support readability instead of replacing it.

The complete game spine is split into macro, meso, and micro layers. Macro state tracks district identity, market cycle, public trust, demand, fame, regulation, weather risk, scandal risk, influence, and skyline status. Meso operations track floor count, transit topology, service coverage, venue credibility, safety readiness, privacy, noise, event readiness, revenue health, and floor-band pressure. Micro agents and visitor cohorts continue to route through Yuka and feed pressure back into macro reputation.

Transit pressure, service pressure, and cleanliness feed tenant sentiment. Sentiment then reduces rent efficiency at midnight, so a tower that technically has rentable rooms can still underperform if people are stuck waiting, working in dirty spaces, or lacking service capacity.

Elevator pressure is measured from capacity, blocked routes, and accumulated wait time. Agents keep waiting when Yuka cannot find a valid route, and elevator cars prioritize the longest-waiting requester so queue behavior is explicit rather than random.

Campaign progression is contract-driven instead of a hard-coded milestone checklist. Act contracts teach the player journey from empty lot to working tower, declared district identity, public landmark, and skyline institution. Reactive contracts emerge from operating pressure, such as overloaded transit, sanitation failures, and public visits, so the left drawer becomes the player's macro/meso/micro briefing. Every contract carries a live score and deadline pressure state so the player can read partial progress and decide whether to chase rewards, avoid trust penalties, or accept a tradeoff. Incomplete objectives expose diagnostics with the relevant lens, build recommendation, and focus inspection when a concrete location exists. Failed pressure contracts now create recovery contracts with trust rewards, turning public mistakes into playable repair arcs instead of dead-end penalties.

Act 3 now includes an explicit tower identity declaration. The player can position the tower as a business hub, vertical village, event destination, civic tower, prestige tower, or mixed ecosystem. That declared identity affects macro demand, fame, public trust risk, reports, and the campaign contract chain; the derived identity still audits whether the built tower actually supports the claim.

The deterministic skyline-charter scenario proves the full Act 1-5 journey in one load. It completes the campaign contracts, awards the skyline charter, switches the campaign into sandbox mode, and immediately creates a rotating city-cycle mandate so the endgame remains contract-driven instead of becoming a completed-state banner. Sandbox mandates derive from current weather, transit, trust, and civic-calendar pressure, and each asks the tower to host another successful public outcome under the active constraint.

Visitor cohorts are modeled as archetype trait vectors rather than milestone scripts. A movie star entourage, politician delegation, foreign prince, press swarm, city inspector tour, school teacher convention, monk visit, or stamp collector convention can be generated from tower identity, fame, public trust, venue mix, regulation/scandal/weather pressure, and current operations. Due inquiries choose a venue, spawn representative visitor agents through the same Yuka routes as workers, derive their Yuka goal personality from cohort traits, arbitrate venue goals through Yuka evaluators, collect cohort spend on arrival, and remain visible in the Contracts drawer. Each cohort also derives a player-facing behavior profile from those traits: temperament, group dynamic, spending signal, values, and dealbreakers. A Yuka `Think` + `GoalEvaluator` hosting planner then turns the same traits and live tower pressures into ranked priorities such as protect privacy, prove safety readiness, protect arrival routes, or buffer noise. Cohort memory records structured pressure reasons for queues, cleanliness, service, privacy, noise, safety, and weather, then surfaces those reasons and the remembered profile as public-pressure badges in the left drawer and agent inspections. The latest public story also exposes the dominant bottleneck, current metric, direct lens action, and inspection focus so the player can move from complaint to diagnosis without correlating multiple panels manually. Negative public memories create targeted repair contracts, such as noise-control work after an angry stamp collector convention, so micro stories become meso build/service objectives and macro trust stakes.

The player can explicitly invite a public visit from the Contracts drawer once a credible venue exists. The visit docket now shows a hosting forecast first: likely cohort, venue, arrival time, friction score, pressure reasons, and concrete fixes to make before committing. Once committed, active-commitment cards show current phase, representative routing count, story risk, and what to protect before the group leaves a durable public memory. This is not a completion shortcut: the invite creates a normal cohort inquiry, adds public-hosting pressure, persists the event, and then the tick loop still handles arrival, Yuka routing, spend, memory, and success/failure.

End-of-day reports summarize revenue, operating costs, net yield, queue pressure, dirt burden, sentiment, service load, public trust, fame, tower identity, reputation movement, notable operating stories, and next risks. These reports are durable campaign state and should remain the bridge between moment-to-moment simulation and the long player journey.

Save/load is slot-based through SQLite. The Settings drawer exposes Autosave, Campaign A, Campaign B, and Sandbox slots with compact summaries for act, day, identity, funds, and saved time; the start screen surfaces existing slots for continue selection. Autosave writes the default continue slot after meaningful progression events such as construction, identity declaration, daily reports, public visits, contract outcomes, milestones, and victory. Durable simulation history is also written to SQLite as queryable event rows for construction, rent, reports, visits, contracts, milestones, and victory. Preferences remain limited to lightweight KV settings and never replace durable save slots or event history.

The default HUD should reserve the playfield for the tower. Live informatics belong in a compact top strip, including active visit count; contracts, city brief, operations, reports, public pressure, and visit docket live in the named left drawer, while saves, audio, accessibility, and secondary operational metrics live in the named right Settings drawer. Click/tap inspection should explain rooms, agents, elevators, and empty bays in plain operational language.

## Visual Direction

The cutaway should not rely on primary-color room blocks. Room identity should come from material language, window cadence, silhouettes, interior props, lighting, signage, and data lenses. Strong saturated colors are reserved for explicit feedback states such as invalid placement, maintenance heat, transit pressure, and critical alerts.

Precision-critical 2D detail belongs in `public/assets/vectors` as crafted SVG composites and reusable element assets. Pixi composes those vectors as textures through typed room templates, so the renderer keeps camera/batching performance while the art direction gets authored linework instead of primitive shape approximations.

The vector vocabulary is intentionally split between structure and identity. Shared structural pieces such as facade ribs, floor slabs, ceiling rails, and dividers must carry the tower's architectural continuity; room-specific pieces like desks, awnings, beds, lamps, plants, signage, and service panels should communicate use without falling back to primary-color category blocks.

Dynamic actors use the same vector vocabulary: workers, guests, janitors, visitors, and transit waiting markers live in `public/assets/vectors/agents` and render as Pixi sprites instead of primitive circles. Expanded room families, such as utilities, restrooms, security, mechanical systems, conference/event spaces, retail, gardens, observation, clinic, gallery, luxury suites, and weather systems, use reusable SVG element composites rather than colored category blocks.

## Render Scalability

The Pixi renderer separates normal-mode static tower base art from dynamic overlays. Structural room SVGs, shafts, and base materials are invalidated by room layout, lighting hour, and occupied-room changes; dirt, agents, elevators, particles, clouds, HUD, and build ghosts redraw independently. This keeps the authored SVG direction viable for larger towers without forcing every simulation tick to rebuild every room's vector composition.

In dev builds, `window.reachForTheSkyRenderer.getStats()` exposes frame, base rebuild, base cache-hit, lens draw, and dynamic overlay counters for quick browser profiling.

`pnpm verify:render-stats` starts a temporary Vite server and headless Chrome session, opens the opening scenario, and fails if normal play does not produce static-base cache hits.

`pnpm verify:build-flow` starts from the menu, clicks tools, drags on the Pixi viewport to commit lobby/floor/office/elevator construction, and switches maintenance, transit, sentiment, privacy, safety, and event data lenses. This keeps the actual interaction path covered in addition to pure placement tests.

`pnpm verify:campaign-flow` opens the skyline-charter scenario and fails unless all five act contracts are completed, the skyline charter permit and sandbox-city-cycle unlock are present, an active sandbox city-cycle mandate is visible, and the victory-state targets remain satisfied.

`pnpm verify:mobile-build-flow` runs Chrome mobile emulation, dispatches touch drags against the Pixi viewport, and confirms that mobile lobby/floor/office construction commits.

`pnpm verify:save-load` uses the same browser harness to select Campaign A, click the app Save control, wait for a real SQLite web row and slot summary, reset the game, and restore the saved snapshot through Load. This protects the Capacitor SQLite + `jeep-sqlite` + WASM path beyond unit-level JSON serialization.

`pnpm verify:corrupt-save` inserts an invalid SQLite save row, verifies the repository quarantines it out of normal save slots, opens Settings, confirms the corrupt-save recovery UI explains the backup, and clears the quarantine entry through the app.

`pnpm verify:preferences` checks the Capacitor Preferences path by writing lens mode through the app, reloading the page, starting a fresh game, and asserting the stored lens mode is restored.

`pnpm verify:report-loop` advances the opening scenario through a live midnight tick loop in headless Chrome, verifies rent collection and the `daily-report` event, asserts that those rows are persisted in SQLite simulation history, asserts Autosave contains the resulting report snapshot, opens the Contracts drawer, and fails if the end-of-day report is not visible to the player.

`pnpm verify:public-memory` opens the skyline-charter scenario, checks that durable visit memories retain structured pressure reasons, and fails unless the top HUD, public-pressure card, latest-public-story diagnosis/action panel, and memory badges expose those reasons in the Contracts drawer. It also clicks the story-panel lens action and asserts the Koota view lens changes.

`pnpm verify:memory-repair` opens the recovery scenario and fails unless a negative public memory has generated a targeted repair contract with concrete pressure objectives, objective diagnostics, lens/build actions, and a follow-up successful-visit requirement.

`pnpm verify:invite-visit` opens the recovery scenario, verifies the hosting forecast is visible before commitment, clicks the Contracts drawer invite action, and fails unless the app creates a real visit inquiry, active-commitment readout, reactive hosting contract, SQLite event row, and autosaved snapshot with the pending visit.

`pnpm verify:visit-lifecycle` opens the recovery scenario, commits an invited visit, advances the live Koota/Yuka simulation through arrival, representative routing, spend, departure, latest-public-story UI, public memory, contract/reputation events, SQLite history rows, and autosaved memory state.

`pnpm verify:menu-scenarios` opens the start screen and fails unless the player-facing scenario cards are present, labeled, and backed by committed preview imagery.

Simulation RNG is carried on the clock snapshot and room visual seeds are derived from stable placement geometry. Avoid raw `Math.random()` in simulation or rendering code; use seeded random sources so captures, saves, and tests stay repeatable.

The audio layer uses Tone.js for procedural fallback cues and Howler.js for the generated `public/assets/audio/reach-ui-cues.ogg` sample sprite. The settings HUD uses Koota `SettingsTrait` for Tone.js procedural volume, Howler sample volume, mute, high-contrast mode, and reduced-motion mode. Those values are stored through Capacitor Preferences with the same hydration gate as camera/lens settings, so startup does not overwrite existing preferences with defaults.

`pnpm verify:audio-assets` decodes the generated OGG cue sprite in headless Chrome and fails if Howler's cue windows no longer fit the shipped asset.

`pnpm verify:app-metadata` validates the PWA/install metadata, manifest icons, committed preview screenshots, OpenGraph/Twitter preview image, and Android launcher resource theme. Keep `public/assets/icons` and `public/assets/previews` current when screenshots or app identity shift.

`pnpm verify:browser` runs the full browser/app verifier set in release order. `pnpm verify:release` adds lint, typecheck, unit tests, production build, screenshots, and Android Capacitor sync on top of that browser suite.

`pnpm capture:screenshots` captures the start menu, desktop/mobile opening PNGs, named left/right drawer PNGs, the daily-report UI, construction ghost, maintenance/transit/value/sentiment/privacy/safety/event lenses, inspection, skyline-victory, public-memory, weather-stress, recovery-contract, invited-visit, resolved visit-lifecycle, and public-story inspection PNGs into `test-screenshots/` for visual regression review after HUD or renderer changes.
