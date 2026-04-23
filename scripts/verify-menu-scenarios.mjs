import { waitFor, withDevPage } from './browser-smoke-harness.mjs';

// Structural checks only. Marketing/landing copy is a product decision, not
// a CI gate — polish passes shouldn't fail here because someone (reasonably)
// changed a kicker or deck. POC/prototype-regression risk is guarded by
// tests/campaignLadderGuard.test.ts (source-level), by reviewers on each PR,
// and by the pillar docs themselves. The verifier only asserts what the
// start surface must *structurally* contain to be a usable start surface.

const expectedScenarios = ['Working Tower', 'Skyline Charter', 'Weather Front', 'Public Recovery'];

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

    process.stdout.write(`${JSON.stringify({ url, menu }, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
