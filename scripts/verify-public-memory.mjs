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

async function readPublicMemoryUi(devtools) {
  return devtools.evaluate(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  const snapshot = actions.createSnapshot();
  const drawer = document.querySelector('.contracts-drawer');
  const pressureCard = document.querySelector('.public-pressure-card');
  const storyCard = document.querySelector('.public-story-card');
  const memoryCards = Array.from(document.querySelectorAll('.memory-card'));
  const pressureTags = Array.from(document.querySelectorAll('.pressure-tag')).map(
    (tag) => tag.textContent?.trim() ?? '',
  );
  return {
    activeVisitsText: Array.from(document.querySelectorAll('.top-metrics article')).map(
      (article) => article.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
    ),
    drawerOpen: drawer?.classList.contains('open') ?? false,
    pressureText: pressureCard?.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
    storyText: storyCard?.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
    memoryText: memoryCards.map((card) => card.textContent?.replace(/\\s+/g, ' ').trim() ?? ''),
    pressureTags,
    structuredReasons: snapshot.tower.visitMemories.map((memory) => ({
      label: memory.label,
      pressureReasons: memory.pressureReasons,
    })),
  };
})()
`);
}

async function main() {
  await withDevPage('/reach-for-the-sky/?scenario=skyline', async ({ url, devtools }) => {
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await devtools.send('Page.navigate', { url });
    await waitFor('skyline scenario rendered', async () => {
      const text = await devtools.evaluate(`document.body.textContent ?? ''`);
      return text.includes('Sandbox') ? true : null;
    });
    await clickButton(devtools, 'Contracts');
    const ui = await waitFor('public memory pressure UI', async () => {
      const value = await readPublicMemoryUi(devtools);
      const hasStructuredReasons = value.structuredReasons.some(
        (memory) => memory.pressureReasons.length > 0,
      );
      const hasPressureCard =
        value.drawerOpen &&
        value.pressureText.includes('Public pressure') &&
        value.pressureText.includes('Queues');
      const hasMemoryBadges =
        value.memoryText.some((text) => text.includes('Pressure') || text.includes('Queues')) ||
        value.pressureTags.some((tag) => tag.includes('Queues'));
      const hasMemoryProfiles = value.memoryText.some(
        (text) => text.includes('Remembered profile') && text.includes('Dealbreakers'),
      );
      const hasLatestStory =
        value.storyText.includes('Latest public story') &&
        value.storyText.includes(value.structuredReasons[0]?.label ?? '') &&
        value.storyText.includes('Dominant pressure') &&
        value.storyText.includes('Bottleneck') &&
        value.storyText.includes('Open Transit Lens');
      const hasVisitsMetric = value.activeVisitsText.some((text) => text.startsWith('Visits'));
      return hasStructuredReasons &&
        hasPressureCard &&
        hasMemoryBadges &&
        hasMemoryProfiles &&
        hasLatestStory &&
        hasVisitsMetric
        ? value
        : null;
    });
    await clickButton(devtools, 'Open Transit Lens');
    const action = await waitFor('public story action opens transit lens', async () => {
      const value = await devtools.evaluate(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  const snapshot = actions.createSnapshot();
  return snapshot.view.lensMode === 'transit'
    ? { lensMode: snapshot.view.lensMode }
    : null;
})()
`);
      return value;
    });
    await clickButton(devtools, 'Contracts');
    await clickButton(devtools, 'Inspect Focus');
    const inspection = await waitFor('public story action opens inspection focus', async () => {
      const value = await devtools.evaluate(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  const traits = await import('/reach-for-the-sky/src/state/traits.ts');
  const world = await import('/reach-for-the-sky/src/state/world.ts');
  const snapshot = actions.createSnapshot();
  const selection = world.gameWorld.get(traits.InspectionTrait)?.selection ?? null;
  const bodyText = document.body.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
  return snapshot.view.lensMode === 'transit' &&
    selection?.context?.source === 'public-story' &&
    bodyText.includes('Public story focus') &&
    bodyText.includes('Foreign prince and retainers')
    ? {
        lensMode: snapshot.view.lensMode,
        inspectionKind: selection.kind,
        title: selection.title,
        context: selection.context,
      }
    : null;
})()
`);
      return value;
    });
    process.stdout.write(`${JSON.stringify({ url, ui, action, inspection }, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
