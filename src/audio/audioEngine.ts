import { Howl, Howler } from 'howler';
import * as Tone from 'tone';
import type { GameSettings } from '@/simulation/types';

export type AudioCue = 'build' | 'rent' | 'warning' | 'elevator' | 'milestone';
export type AudioSpriteMap = Record<AudioCue, [offsetMs: number, durationMs: number]>;

export const DEFAULT_AUDIO_SPRITE: AudioSpriteMap = {
  build: [0, 180],
  rent: [240, 220],
  warning: [520, 320],
  elevator: [900, 130],
  milestone: [1090, 440],
};

export const DEFAULT_AUDIO_SAMPLE_PATHS = ['assets/audio/reach-ui-cues.ogg'] as const;

export function resolveAudioAsset(path: string, baseUrl = import.meta.env.BASE_URL): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${path}`;
}

export class SkyAudioEngine {
  private unlocked = false;
  private synth: Tone.PolySynth | null = null;
  private membrane: Tone.MembraneSynth | null = null;
  private samples = new Map<AudioCue, Howl>();
  private sampleSprite: Howl | null = null;
  private sampleSpriteCues = new Set<AudioCue>();
  private settings: GameSettings['audio'];

  constructor(settings: GameSettings['audio']) {
    this.settings = settings;
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
    const sample = this.samples.get(cue);
    if (sample?.state() === 'loaded') {
      sample.play();
      return;
    }
    if (this.sampleSprite?.state() === 'loaded' && this.sampleSpriteCues.has(cue)) {
      this.sampleSprite.play(cue);
      return;
    }
    this.playProcedural(cue);
  }

  private playProcedural(cue: AudioCue): void {
    if (!this.unlocked || !this.synth || !this.membrane) return;
    const now = Tone.now();
    if (cue === 'build') this.synth.triggerAttackRelease(['C4', 'G4'], '16n', now);
    else if (cue === 'rent') this.synth.triggerAttackRelease(['E4', 'A4', 'C5'], '8n', now);
    else if (cue === 'warning') this.synth.triggerAttackRelease(['C3', 'C#3'], '16n', now);
    else if (cue === 'elevator') this.synth.triggerAttackRelease('B5', '32n', now);
    else if (cue === 'milestone') this.membrane.triggerAttackRelease('C2', '8n', now);
  }
}
