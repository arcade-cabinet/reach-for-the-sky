export type NativeBackState = {
  settingsOpen: boolean;
  contractsOpen: boolean;
  playing: boolean;
  canGoBack: boolean;
};

export type NativeBackAction =
  | 'close-settings'
  | 'close-contracts'
  | 'pause-to-settings'
  | 'browser-back'
  | 'minimize-app';

export const resolveNativeBackAction = (state: NativeBackState): NativeBackAction => {
  if (state.settingsOpen) return 'close-settings';
  if (state.contractsOpen) return 'close-contracts';
  if (state.playing) return 'pause-to-settings';
  if (state.canGoBack) return 'browser-back';
  return 'minimize-app';
};
