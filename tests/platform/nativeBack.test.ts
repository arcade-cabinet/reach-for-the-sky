import { describe, expect, it } from 'vitest';
import { type NativeBackState, resolveNativeBackAction } from '@/platform/nativeBack';

const baseState: NativeBackState = {
  settingsOpen: false,
  contractsOpen: false,
  playing: false,
  canGoBack: false,
};

describe('native back handling', () => {
  it('closes Settings before any other native action', () => {
    expect(
      resolveNativeBackAction({
        ...baseState,
        settingsOpen: true,
        contractsOpen: true,
        playing: true,
        canGoBack: true,
      }),
    ).toBe('close-settings');
  });

  it('closes Contracts before pausing gameplay or leaving the app shell', () => {
    expect(
      resolveNativeBackAction({
        ...baseState,
        contractsOpen: true,
        playing: true,
        canGoBack: true,
      }),
    ).toBe('close-contracts');
  });

  it('pauses an active run into Settings before browser history fallback', () => {
    expect(resolveNativeBackAction({ ...baseState, playing: true, canGoBack: true })).toBe(
      'pause-to-settings',
    );
  });

  it('uses browser history when no game panel or active run needs handling', () => {
    expect(resolveNativeBackAction({ ...baseState, canGoBack: true })).toBe('browser-back');
  });

  it('minimizes the native app when nothing in-game or in-history can consume Back', () => {
    expect(resolveNativeBackAction(baseState)).toBe('minimize-app');
  });
});
