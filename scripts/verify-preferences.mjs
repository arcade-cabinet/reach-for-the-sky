import { waitFor, withDevPage } from './browser-smoke-harness.mjs';

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

async function clickButton(devtools, label) {
  const clicked = await devtools.evaluate(buttonExpression(label));
  if (!clicked) throw new Error(`Could not find ${label} button`);
}

async function readPreference(devtools, key, fallback) {
  return devtools.evaluate(`
(async () => {
  const { getPreferenceJson, PREF_KEYS } = await import('/reach-for-the-sky/src/persistence/preferences.ts');
  return getPreferenceJson(PREF_KEYS[${JSON.stringify(key)}], ${JSON.stringify(fallback)});
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

    await clickButton(devtools, 'Break Ground');
    await waitFor('lens panel', async () => {
      const ready = await devtools.evaluate(
        `document.body.textContent?.includes('Maintenance') ?? false`,
      );
      return ready ? true : null;
    });

    await clickButton(devtools, 'Maintenance');
    await waitFor('active maintenance lens', async () => {
      const lensMode = await devtools.evaluate(`
(() => {
  const button = Array.from(document.querySelectorAll('.lens-panel button')).find(
    (candidate) => candidate.textContent?.trim() === 'Maintenance',
  );
  return button?.classList.contains('active') ? 'maintenance' : null;
})()
`);
      return lensMode;
    });
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
      const lensMode = await devtools.evaluate(`
(() => {
  const button = Array.from(document.querySelectorAll('.lens-panel button')).find(
    (candidate) => candidate.textContent?.trim() === 'Maintenance',
  );
  return button?.classList.contains('active') ? 'maintenance' : null;
})()
`);
      return lensMode;
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
