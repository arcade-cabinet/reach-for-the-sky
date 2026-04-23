import { waitFor, withDevPage } from './browser-smoke-harness.mjs';

const expectedScenarios = ['Working Tower', 'Skyline Charter', 'Weather Front', 'Public Recovery'];
const expectedLandingCopy = [
  'Campaign-backed living tower simulator',
  'Macro: district pressure',
  'Meso: tower operations',
  'Micro: people with memory',
  'No rote VIP checklist',
  'Playable city moments',
];
const forbiddenPlayerFacingCopy = /\b(POC|prototype|demo|implementation detail)\b/i;

async function main() {
  await withDevPage('/reach-for-the-sky/?skip-intro=1', async ({ url, devtools }) => {
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await devtools.send('Page.navigate', { url });

    const menu = await waitFor(
      'scenario menu with preview cards',
      async () => {
        const value = await devtools.evaluate(`
(() => {
  const startScreen = document.querySelector('.start-screen');
  const text = startScreen?.textContent ?? '';
  const cards = Array.from(startScreen?.querySelectorAll('.scenario-grid button') ?? []).map((button) => {
    const image = button.querySelector('img');
    return {
      text: button.textContent ?? '',
      image: image?.getAttribute('src') ?? '',
      loaded: Boolean(image?.complete && image.naturalWidth > 0),
    };
  });
  return text.includes('Break Ground') && cards.length >= 4 && cards.every((card) => card.loaded)
    ? { cards, text }
    : null;
})()
`);
        return value;
      },
      20_000,
    );

    for (const label of expectedScenarios) {
      if (!menu.cards.some((card) => card.text.includes(label))) {
        throw new Error(`Missing scenario card: ${label}`);
      }
    }
    if (!menu.cards.every((card) => card.image.includes('/assets/previews/'))) {
      throw new Error('Scenario cards must use committed preview imagery');
    }
    for (const copy of expectedLandingCopy) {
      if (!menu.text.includes(copy)) {
        throw new Error(`Missing production landing copy: ${copy}`);
      }
    }
    if (forbiddenPlayerFacingCopy.test(menu.text)) {
      throw new Error('Start screen contains prototype/demo language in player-facing copy');
    }

    process.stdout.write(`${JSON.stringify({ url, menu }, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
