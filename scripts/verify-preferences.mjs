import { waitFor, withDevPage } from './browser-smoke-harness.mjs';

const PREFERENCE_KEYS = {
  lensMode: 'reach.sky.ui.lens_mode',
  muted: 'reach.sky.audio.muted',
};

const buttonExpression = (label) => `
(() => {
  const button = Array.from(document.querySelectorAll('button')).find((candidate) => {
    const text = candidate.textContent?.trim() ?? '';
    return text === ${JSON.stringify(label)} || text.startsWith(${JSON.stringify(label)});
  });
  if (!button) return false;
  button.click();
  return true;
})()
`;

const scopedButtonExpression = (selector, label) => `
(() => {
  const button = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(
    (candidate) => candidate.textContent?.trim() === ${JSON.stringify(label)},
  );
  if (!button) return false;
  button.click();
  return true;
})()
`;

async function clickButton(devtools, label) {
  const clicked = await devtools.evaluate(buttonExpression(label));
  if (!clicked) throw new Error(`Could not find ${label} button`);
}

async function clickScopedButton(devtools, selector, label) {
  const clicked = await devtools.evaluate(scopedButtonExpression(selector, label));
  if (!clicked) throw new Error(`Could not find ${label} button in ${selector}`);
}

async function activateLens(devtools, label, mode) {
  return waitFor(
    `active ${label.toLowerCase()} lens`,
    async () => {
      const lensMode = await readLensMode(devtools);
      if (lensMode === mode) return lensMode;
      await devtools.evaluate(scopedButtonExpression('.lens-panel button', label));
      return null;
    },
    30_000,
  );
}

async function readLensMode(devtools) {
  return devtools.evaluate(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  return actions.createSnapshot().view.lensMode;
})()
`);
}

async function readPreference(devtools, key, fallback) {
  const storageKey = PREFERENCE_KEYS[key];
  if (!storageKey) throw new Error(`Unknown preference key: ${key}`);
  return devtools.evaluate(`
(() => {
  const storageKey = ${JSON.stringify(storageKey)};
  const raw =
    window.localStorage.getItem(\`CapacitorStorage.\${storageKey}\`) ??
    window.localStorage.getItem(storageKey);
  if (!raw) return ${JSON.stringify(fallback)};
  try {
    return JSON.parse(raw);
  } catch {
    return ${JSON.stringify(fallback)};
  }
})()
`);
}

async function clearPreferenceStorage(devtools) {
  await devtools.evaluate(`
(() => {
  const keys = ${JSON.stringify(Object.values(PREFERENCE_KEYS))};
  for (const key of keys) {
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(\`CapacitorStorage.\${key}\`);
  }
})()
`);
}

async function main() {
  await withDevPage('/reach-for-the-sky/', async ({ url, devtools }) => {
    await waitFor('start screen', async () => {
      const ready = await devtools.evaluate(
        `document.body.textContent?.includes('Break Ground') ?? false`,
      );
      return ready ? true : null;
    });
    await clearPreferenceStorage(devtools);
    await devtools.send('Page.navigate', { url });
    await waitFor('fresh start screen', async () => {
      const ready = await devtools.evaluate(
        `document.body.textContent?.includes('Break Ground') ?? false`,
      );
      return ready ? true : null;
    });

    await clickButton(devtools, 'Break Ground');
    await waitFor('lens panel', async () => {
      const ready = await devtools.evaluate(
        `document.body.textContent?.includes('Maintenance') ?? false`,
      );
      return ready ? true : null;
    });

    await clickScopedButton(devtools, '.lens-panel button', 'Maintenance');
    await activateLens(devtools, 'Maintenance', 'maintenance');
    await waitFor('stored maintenance lens preference', async () => {
      const lensMode = await readPreference(devtools, 'lensMode', 'normal');
      return lensMode === 'maintenance' ? lensMode : null;
    });
    await clickButton(devtools, 'Settings');
    await clickButton(devtools, 'Mute');
    await waitFor('active mute setting', async () => {
      const isMuted = await devtools.evaluate(`
(() => {
  const button = Array.from(document.querySelectorAll('.settings-toggles button')).find(
    (candidate) => candidate.textContent?.trim() === 'Mute',
  );
  return button?.classList.contains('active') ? true : null;
})()
`);
      return isMuted;
    });
    await waitFor('stored mute preference', async () => {
      const muted = await readPreference(devtools, 'muted', false);
      return muted === true ? true : null;
    });

    await devtools.send('Page.navigate', { url });
    await waitFor('reloaded start screen', async () => {
      const ready = await devtools.evaluate(
        `document.body.textContent?.includes('Break Ground') ?? false`,
      );
      return ready ? true : null;
    });

    await clickButton(devtools, 'Break Ground');
    const activeLens = await waitFor('restored maintenance lens', async () => {
      const lensMode = await readLensMode(devtools);
      return lensMode === 'maintenance' ? lensMode : null;
    });
    await clickButton(devtools, 'Settings');
    const muted = await waitFor('restored mute setting', async () => {
      const isMuted = await devtools.evaluate(`
(() => {
  const button = Array.from(document.querySelectorAll('.settings-toggles button')).find(
    (candidate) => candidate.textContent?.trim() === 'Mute',
  );
  return button?.classList.contains('active') ? true : null;
})()
`);
      return isMuted;
    });

    process.stdout.write(
      `${JSON.stringify({ url, preferences: { activeLens, muted } }, null, 2)}\n`,
    );
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
