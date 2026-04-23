export interface PreferencesAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

export const PREF_KEYS = {
  lensMode: 'reach.sky.ui.lens_mode',
  camera: 'reach.sky.ui.camera',
  tutorialStep: 'reach.sky.ui.tutorial_step',
  firstRunSeen: 'reach.sky.ui.first_run_seen',
  proceduralVolume: 'reach.sky.audio.procedural_volume',
  sampleVolume: 'reach.sky.audio.sample_volume',
  muted: 'reach.sky.audio.muted',
  highContrast: 'reach.sky.accessibility.high_contrast',
  reducedMotion: 'reach.sky.accessibility.reduced_motion',
  displayScale: 'reach.sky.ui.display_scale',
  inputHints: 'reach.sky.ui.input_hints',
  diagnosticsVisible: 'reach.sky.ui.diagnostics_visible',
  safeAreaMode: 'reach.sky.ui.safe_area_mode',
} as const;

export type PreferenceKey = (typeof PREF_KEYS)[keyof typeof PREF_KEYS];

class LocalPreferences implements PreferencesAdapter {
  async get(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  }

  async keys(): Promise<string[]> {
    if (typeof localStorage === 'undefined') return [];
    return Object.keys(localStorage).filter((key) => key.startsWith('reach.sky.'));
  }

  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    for (const key of await this.keys()) localStorage.removeItem(key);
  }
}

let adapter: PreferencesAdapter = new LocalPreferences();

export function setPreferencesAdapter(next: PreferencesAdapter): void {
  adapter = next;
}

export async function installCapacitorPreferences(): Promise<void> {
  const { Preferences } = await import('@capacitor/preferences');
  setPreferencesAdapter({
    async get(key) {
      return (await Preferences.get({ key })).value;
    },
    async set(key, value) {
      await Preferences.set({ key, value });
    },
    async remove(key) {
      await Preferences.remove({ key });
    },
    async keys() {
      return (await Preferences.keys()).keys.filter((key) => key.startsWith('reach.sky.'));
    },
    async clear() {
      for (const key of (await Preferences.keys()).keys.filter((candidate) =>
        candidate.startsWith('reach.sky.'),
      )) {
        await Preferences.remove({ key });
      }
    },
  });
}

export const preferences: PreferencesAdapter = {
  get: (key) => adapter.get(key),
  set: (key, value) => adapter.set(key, value),
  remove: (key) => adapter.remove(key),
  keys: () => adapter.keys(),
  clear: () => adapter.clear(),
};

export async function getPreferenceJson<T>(key: PreferenceKey, fallback: T): Promise<T> {
  const raw = await preferences.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setPreferenceJson<T>(key: PreferenceKey, value: T): Promise<void> {
  await preferences.set(key, JSON.stringify(value));
}
