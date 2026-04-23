import { describe, expect, it } from 'vitest';
import {
  type AudioCue,
  DEFAULT_AUDIO_SAMPLE_PATHS,
  DEFAULT_AUDIO_SPRITE,
  resolveAudioAsset,
} from '@/audio/audioEngine';

const EXPECTED_CUES: AudioCue[] = ['build', 'rent', 'warning', 'elevator', 'milestone'];

describe('audio cue sprite manifest', () => {
  it('covers every simulation cue with a positive OGG sprite window', () => {
    expect(Object.keys(DEFAULT_AUDIO_SPRITE).sort()).toEqual([...EXPECTED_CUES].sort());
    for (const cue of EXPECTED_CUES) {
      const [offset, duration] = DEFAULT_AUDIO_SPRITE[cue];
      expect(offset, `${cue} offset`).toBeGreaterThanOrEqual(0);
      expect(duration, `${cue} duration`).toBeGreaterThan(0);
    }
  });

  it('keeps sprite windows ordered and non-overlapping', () => {
    const windows = EXPECTED_CUES.map((cue) => [cue, ...DEFAULT_AUDIO_SPRITE[cue]] as const).sort(
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
