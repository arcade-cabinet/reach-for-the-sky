---
title: Audio
updated: 2026-04-23
status: current
domain: audio
---

# Reach for the Sky — Audio

Two-layer audio system. **Short cues** play on specific sim events (built, rented, visit arrived, drawer opened). **Contextual ambient score** breathes continuously in response to current tower state. Players can mute or tune each layer independently; settings persist via `Preferences`.

## Cue taxonomy

Every cue is reachable through both a recorded OGG sprite segment **and** a procedural Tone.js fallback. The engine tries sample-first, then procedural — so no cue is ever silent, and a failed OGG load (or the T11 placeholder cues whose OGG segment is zero-duration) still plays audibly.

| Cue | Trigger | Sampled today | Procedural fallback |
|---|---|---|---|
| `build` | new room placed | yes | two-note C4+G4 poly synth |
| `rent` | daily rent loop succeeds | yes | E4/A4/C5 chord |
| `warning` | rent leak / contract failure / bad visit | yes | dyad C3+C♯3 (tense) |
| `elevator` | cafe sale / transit accent | yes | B5 blip |
| `milestone` | act advance / victory / scenario enter | yes | C2 membrane thud |
| `visit-arrival` | visit representatives enter the tower | placeholder (OGG pending) | rising G4+B4 → D5 cadence |
| `visit-departure` | visit closes out | placeholder | falling D5 → B4+G4 cadence (brackets arrival) |
| `contract-complete` | authored / reactive contract resolves | placeholder | C4+E4+G4+C5 bright chord + C3 bass stamp |
| `drawer-open` | contracts or settings drawer opens | placeholder | single G5 tick (subordinate to gameplay) |

When the `reach-ui-cues.ogg` sprite is regenerated to include the four placeholder cues, bump their `durationMs` above 0 in `DEFAULT_AUDIO_SPRITE` and the sample path will light up automatically. No `play()`-site changes needed.

## Contextual ambient score

`SkyAudioEngine.updateAmbient({ transitPressure, agentCount, publicTrust })` is called every simulation tick. It drives a slow-attack `AMSynth` through a `Tone.Gain`:

- **Transit pressure** shifts detune upward. 100% pressure nudges the drone ~+22 cents — a subtle tightening the ear registers without foregrounding.
- **Agent count** lifts gain. A crowded tower has a louder underbed than an empty lot.
- **Public trust < 40** subtracts detune (mild minor-ish cast). The tower "sounds unwell" when the city is turning on it.

All parameter moves use Tone ramps (0.8s detune, 1.2s gain) so per-tick calls never cause zippering. Muted or pre-unlock calls are no-ops.

## Settings + persistence

Three knobs surfaced in the Settings drawer; all persisted via the existing `Preferences` wiring (T05-era):

| Pref key | Meaning |
|---|---|
| `reach.sky.audio.sample_volume` | Howler master for the OGG sprite + any discrete samples |
| `reach.sky.audio.procedural_volume` | Tone.js poly/membrane/ambient volume (shared) |
| `reach.sky.audio.muted` | Global mute; engine drops Howler to 0 and synths to −90 dB |

`applySettings` updates all three synth channels plus Howler in one pass. The ambient drone's volume is tied to the procedural channel so muting silences the underbed alongside cues.

## Browser audio unlock

Web audio is gated behind a user gesture. `SkyAudioEngine` constructs immediately on app boot but defers synth instantiation to `unlock()`, which runs on the first user interaction (button click, tap). Pre-unlock, `play()` drops to sample-only (Howler works without the Tone context), and `updateAmbient()` is a no-op.

## Authoring notes

- OGG cue sprite lives at `public/assets/audio/reach-ui-cues.ogg`. Per-cue offsets/durations in `src/audio/audioEngine.ts` (`DEFAULT_AUDIO_SPRITE`). See `public/assets/audio/README.md` for the original synthesis notes; the file contains no third-party material.
- New cues added after T11 should land with a procedural fallback first (low-risk, always available), then get a sampled segment when the sprite is re-synthesized. Zero-duration sprite entries are the signal for "procedural-only right now."
- Ambient params are tunable in `src/audio/audioEngine.ts` → `updateAmbient`. The goal is *always-subordinate* — the ambient score should be pre-attentive, not foregrounded. If a player ever notices it more than the cues, the gain or detune range is too aggressive.
