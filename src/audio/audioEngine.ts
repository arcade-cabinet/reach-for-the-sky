import { Howl, Howler } from 'howler';
import * as Tone from 'tone';
import type { GameSettings } from '@/simulation/types';

export type AudioCue =
  | 'build'
  | 'rent'
  | 'warning'
  | 'elevator'
  | 'milestone'
  | 'visit-arrival'
  | 'visit-departure'
  | 'contract-complete'
  | 'drawer-open';
export type AudioSpriteMap = Record<AudioCue, [offsetMs: number, durationMs: number]>;

export const DEFAULT_AUDIO_SPRITE: AudioSpriteMap = {
  build: [0, 180],
  rent: [240, 220],
  warning: [520, 320],
  elevator: [900, 130],
  milestone: [1090, 440],
  // New cues land past the end of the committed sprite — they fall through to
  // the procedural layer (zero duration signals "not yet sampled"). Procedural
  // fallback fully covers every cue, so no cue is silent.
  'visit-arrival': [1600, 0],
  'visit-departure': [1600, 0],
  'contract-complete': [1600, 0],
  'drawer-open': [1600, 0],
};

export const DEFAULT_AUDIO_SAMPLE_PATHS = ['assets/audio/reach-ui-cues.ogg'] as const;

// Minimum time between two plays of the same cue, in ms. Cues missing from
// this map have no debounce. 200ms on drawer-open collapses a mash-and-close
// into a single cue and keeps the Howler HTML5 pool from exhausting during
// rapid-fire UI toggles.
const CUE_DEBOUNCE_MS: Partial<Record<AudioCue, number>> = {
  'drawer-open': 200,
};

export function resolveAudioAsset(path: string, baseUrl = import.meta.env.BASE_URL): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${path}`;
}

export interface AmbientContext {
  transitPressure: number;
  agentCount: number;
  publicTrust: number;
}

export class SkyAudioEngine {
  private unlocked = false;
  private synth: Tone.PolySynth | null = null;
  private membrane: Tone.MembraneSynth | null = null;
  private ambient: Tone.AMSynth | null = null;
  private ambientGain: Tone.Gain | null = null;
  private samples = new Map<AudioCue, Howl>();
  private sampleSprite: Howl | null = null;
  private sampleSpriteCues = new Set<AudioCue>();
  private settings: GameSettings['audio'];
  // Per-cue last-played timestamps (ms, performance.now()). Used to debounce
  // rapid-fire cues like drawer-open that a hurried player (or a verifier
  // toggling two drawers in the same turn) can queue faster than the sample
  // duration, exhausting Howler's HTML5 audio pool.
  private lastPlayedAt = new Map<AudioCue, number>();

  constructor(settings: GameSettings['audio']) {
    this.settings = settings;
    // Default Howler HTML5 audio pool is 10 objects. That fills quickly with
    // rapid-fire cues (drawer toggles, visit arrivals during a convention,
    // chained rents) and surfaces "HTML5 Audio pool exhausted" warnings that
    // the T13 console-clean gate catches. 32 is comfortable for real play
    // without being extravagant.
    Howler.html5PoolSize = 32;
    Howler.volume(settings.muted ? 0 : settings.sampleVolume);
    this.registerSampleSprite(
      DEFAULT_AUDIO_SAMPLE_PATHS.map((path) => resolveAudioAsset(path)),
      DEFAULT_AUDIO_SPRITE,
    );
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    await Tone.start();
    this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
    this.membrane = new Tone.MembraneSynth().toDestination();

    // Contextual ambient drone. Starts silent; updateAmbient() tracks tower
    // state. AMSynth gives a soft breathing texture rather than a steady hum.
    this.ambientGain = new Tone.Gain(0).toDestination();
    this.ambient = new Tone.AMSynth({
      harmonicity: 1.6,
      oscillator: { type: 'sine' },
      envelope: { attack: 1.4, decay: 0.4, sustain: 0.9, release: 2.0 },
    }).connect(this.ambientGain);
    this.ambient.triggerAttack('A2');

    this.applySettings(this.settings);
    this.unlocked = true;
  }

  applySettings(settings: GameSettings['audio']): void {
    this.settings = settings;
    Howler.volume(settings.muted ? 0 : settings.sampleVolume);
    if (this.synth)
      this.synth.volume.value = settings.muted ? -90 : Tone.gainToDb(settings.proceduralVolume);
    if (this.membrane)
      this.membrane.volume.value = settings.muted ? -90 : Tone.gainToDb(settings.proceduralVolume);
    if (this.ambient)
      this.ambient.volume.value = settings.muted ? -90 : Tone.gainToDb(settings.proceduralVolume);
  }

  /**
   * Update the contextual procedural score from current tower state. Called
   * per-tick (at a throttled rate is fine — the gain/detune ramps smooth it).
   *
   * - Transit pressure shifts detune upward (queues feel tenser).
   * - Agent count lifts ambient gain (bigger crowds = louder underbed).
   * - Public trust below 40 adds a mild minor-ish cast via detune offset.
   *
   * Muted or pre-unlock is a no-op.
   */
  updateAmbient(context: AmbientContext): void {
    if (!this.unlocked || !this.ambient || !this.ambientGain || this.settings.muted) return;
    const pressure = Math.max(0, Math.min(100, context.transitPressure)) / 100;
    const density = Math.min(1, context.agentCount / 40);
    const distressed = context.publicTrust < 40 ? (40 - context.publicTrust) / 40 : 0;

    const detune = pressure * 22 - distressed * 14;
    this.ambient.detune.rampTo(detune, 0.8);
    const target = 0.04 + density * 0.08 + pressure * 0.03;
    this.ambientGain.gain.rampTo(target, 1.2);
  }

  registerSample(cue: AudioCue, urls: string[]): void {
    this.samples.set(
      cue,
      new Howl({
        src: urls,
        html5: true,
        preload: true,
        volume: this.settings.sampleVolume,
      }),
    );
  }

  registerSampleSprite(urls: string[], sprite: AudioSpriteMap): void {
    this.sampleSpriteCues = new Set(Object.keys(sprite) as AudioCue[]);
    this.sampleSprite = new Howl({
      src: urls,
      html5: true,
      preload: true,
      sprite,
      volume: this.settings.sampleVolume,
      onloaderror: () => {
        this.sampleSprite = null;
        this.sampleSpriteCues.clear();
      },
    });
  }

  play(cue: AudioCue): void {
    if (this.settings.muted) return;
    // Cue-level debounce. Map holds per-cue minimum gap in ms; cues absent
    // from the map play every time. Tuned so a deliberate user click still
    // hits but mashing or rapid programmatic toggles collapse to one cue.
    const debounceMs = CUE_DEBOUNCE_MS[cue];
    if (debounceMs) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const last = this.lastPlayedAt.get(cue) ?? -Infinity;
      if (now - last < debounceMs) return;
      this.lastPlayedAt.set(cue, now);
    }
    const sample = this.samples.get(cue);
    if (sample?.state() === 'loaded') {
      sample.play();
      return;
    }
    // Sprite cues with zero duration are placeholder slots for cues that
    // exist procedurally but haven't been recorded in the OGG yet.
    if (this.sampleSprite?.state() === 'loaded' && this.sampleSpriteCues.has(cue)) {
      const sprite = DEFAULT_AUDIO_SPRITE[cue];
      if (sprite && sprite[1] > 0) {
        this.sampleSprite.play(cue);
        return;
      }
    }
    this.playProcedural(cue);
  }

  private playProcedural(cue: AudioCue): void {
    if (!this.unlocked || !this.synth || !this.membrane) return;
    const now = Tone.now();
    switch (cue) {
      case 'build':
        this.synth.triggerAttackRelease(['C4', 'G4'], '16n', now);
        break;
      case 'rent':
        this.synth.triggerAttackRelease(['E4', 'A4', 'C5'], '8n', now);
        break;
      case 'warning':
        this.synth.triggerAttackRelease(['C3', 'C#3'], '16n', now);
        break;
      case 'elevator':
        this.synth.triggerAttackRelease('B5', '32n', now);
        break;
      case 'milestone':
        this.membrane.triggerAttackRelease('C2', '8n', now);
        break;
      case 'visit-arrival':
        // Rising minor-major third, warm welcome cadence.
        this.synth.triggerAttackRelease(['G4', 'B4'], '8n', now);
        this.synth.triggerAttackRelease('D5', '16n', now + 0.12);
        break;
      case 'visit-departure':
        // Falling counterpart so the pair bracket a visit.
        this.synth.triggerAttackRelease('D5', '16n', now);
        this.synth.triggerAttackRelease(['B4', 'G4'], '8n', now + 0.1);
        break;
      case 'contract-complete':
        // Bright resolved chord, differentiated from 'rent' by bass membrane.
        this.synth.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '4n', now);
        this.membrane.triggerAttackRelease('C3', '16n', now);
        break;
      case 'drawer-open':
        // Single-note soft tick, keeps it subordinate to gameplay cues.
        this.synth.triggerAttackRelease('G5', '32n', now);
        break;
    }
  }
}
