import { describe, expect, it } from 'vitest';
import {
  type AudioCue,
  DEFAULT_AUDIO_SAMPLE_PATHS,
  DEFAULT_AUDIO_SPRITE,
  resolveAudioAsset,
} from '@/audio/audioEngine';

// Cues that have a recorded OGG segment committed today.
const SAMPLED_CUES: AudioCue[] = ['build', 'rent', 'warning', 'elevator', 'milestone'];

// Cues added in T11 that currently fall through to the procedural Tone.js
// layer. Their sprite entries exist as placeholders with duration=0 so the
// TS union is exhaustive; the play() path skips zero-duration sprite hits
// and reaches the procedural branch instead.
const PROCEDURAL_ONLY_CUES: AudioCue[] = [
  'visit-arrival',
  'visit-departure',
  'contract-complete',
  'drawer-open',
];

const ALL_CUES: AudioCue[] = [...SAMPLED_CUES, ...PROCEDURAL_ONLY_CUES];

describe('audio cue sprite manifest', () => {
  it('covers every AudioCue with an entry (sampled or procedural placeholder)', () => {
    expect(Object.keys(DEFAULT_AUDIO_SPRITE).sort()).toEqual([...ALL_CUES].sort());
  });

  it('every sampled cue has a positive OGG sprite window', () => {
    for (const cue of SAMPLED_CUES) {
      const [offset, duration] = DEFAULT_AUDIO_SPRITE[cue];
      expect(offset, `${cue} offset`).toBeGreaterThanOrEqual(0);
      expect(duration, `${cue} duration`).toBeGreaterThan(0);
    }
  });

  it('procedural-only cues have zero-duration placeholders so play() falls through', () => {
    for (const cue of PROCEDURAL_ONLY_CUES) {
      const [, duration] = DEFAULT_AUDIO_SPRITE[cue];
      expect(duration, `${cue} should be procedural-only until the OGG is regenerated`).toBe(0);
    }
  });

  it('keeps sampled-cue windows ordered and non-overlapping', () => {
    const windows = SAMPLED_CUES.map((cue) => [cue, ...DEFAULT_AUDIO_SPRITE[cue]] as const).sort(
      (a, b) => a[1] - b[1],
    );
    for (let index = 1; index < windows.length; index += 1) {
      const previous = windows[index - 1];
      const current = windows[index];
      if (!previous || !current) throw new Error('Missing audio window');
      expect(current[1], current[0]).toBeGreaterThanOrEqual(previous[1] + previous[2]);
    }
  });

  it('resolves the default public OGG asset under the Vite base path', () => {
    expect(DEFAULT_AUDIO_SAMPLE_PATHS).toEqual(['assets/audio/reach-ui-cues.ogg']);
    expect(resolveAudioAsset(DEFAULT_AUDIO_SAMPLE_PATHS[0], '/reach-for-the-sky/')).toBe(
      '/reach-for-the-sky/assets/audio/reach-ui-cues.ogg',
    );
  });
});
