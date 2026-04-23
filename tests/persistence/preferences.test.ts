import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPreferenceJson,
  PREF_KEYS,
  preferences,
  setPreferenceJson,
} from '@/persistence/preferences';

beforeEach(async () => {
  await preferences.clear();
});

describe('preferences wrapper', () => {
  it('stores typed JSON behind Capacitor-compatible string keys', async () => {
    await setPreferenceJson(PREF_KEYS.camera, { panX: 12, panY: 34, zoom: 1.5 });

    await expect(
      getPreferenceJson(PREF_KEYS.camera, { panX: 0, panY: 0, zoom: 1 }),
    ).resolves.toEqual({
      panX: 12,
      panY: 34,
      zoom: 1.5,
    });
  });

  it('falls back when stored JSON is corrupt', async () => {
    await preferences.set(PREF_KEYS.lensMode, '{bad');
    await expect(getPreferenceJson(PREF_KEYS.lensMode, 'normal')).resolves.toBe('normal');
  });

  it('stores granular production UI preferences independently', async () => {
    await setPreferenceJson(PREF_KEYS.displayScale, 1.15);
    await setPreferenceJson(PREF_KEYS.inputHints, false);
    await setPreferenceJson(PREF_KEYS.diagnosticsVisible, true);
    await setPreferenceJson(PREF_KEYS.safeAreaMode, 'compact');

    await expect(getPreferenceJson(PREF_KEYS.displayScale, 1)).resolves.toBe(1.15);
    await expect(getPreferenceJson(PREF_KEYS.inputHints, true)).resolves.toBe(false);
    await expect(getPreferenceJson(PREF_KEYS.diagnosticsVisible, false)).resolves.toBe(true);
    await expect(getPreferenceJson(PREF_KEYS.safeAreaMode, 'auto')).resolves.toBe('compact');
  });
});
