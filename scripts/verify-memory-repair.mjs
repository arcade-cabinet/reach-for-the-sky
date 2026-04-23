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

async function clickButtonInCard(devtools, cardText, label) {
  const clicked = await devtools.evaluate(`
(() => {
  const card = Array.from(document.querySelectorAll('.contract-card')).find((candidate) =>
    candidate.textContent?.includes(${JSON.stringify(cardText)}),
  );
  if (!card) return false;
  const button = Array.from(card.querySelectorAll('button')).find((candidate) => {
    const text = candidate.textContent?.trim() ?? '';
    return text === ${JSON.stringify(label)} || text.startsWith(${JSON.stringify(label)});
  });
  if (!button) return false;
  button.click();
  return true;
})()
`);
  if (!clicked) throw new Error(`Could not find ${label} button in ${cardText}`);
}

async function readMemoryRepairState(devtools) {
  return devtools.evaluate(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  const snapshot = actions.createSnapshot();
  const contracts = snapshot.campaign.activeContracts.map((contract) => ({
    id: contract.id,
    title: contract.title,
    source: contract.source ?? null,
    score: contract.score,
    objectives: contract.objectives.map((objective) => ({
      label: objective.label,
      metric: objective.metric,
      value: objective.value,
      target: objective.target,
    })),
  }));
  const memory = snapshot.tower.visitMemories[0] ?? null;
  const drawer = document.querySelector('.contracts-drawer');
  return {
    contracts,
    memory,
    drawerOpen: drawer?.classList.contains('open') ?? false,
    bodyText: document.body.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
  };
})()
`);
}

async function main() {
  await withDevPage('/reach-for-the-sky/?scenario=recovery', async ({ url, devtools }) => {
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await devtools.send('Page.navigate', { url });
    await waitFor('recovery scenario rendered', async () => {
      const text = await devtools.evaluate(`document.body.textContent ?? ''`);
      return text.includes('Recovery drill loaded') ? true : null;
    });
    await clickButton(devtools, 'Contracts');
    const state = await waitFor('memory repair contract visible', async () => {
      const value = await readMemoryRepairState(devtools);
      const repair = value.contracts.find((contract) => contract.source === 'memory-noise');
      const hasMemory = value.memory?.pressureReasons?.includes('noise');
      const hasUi =
        value.drawerOpen &&
        value.bodyText.includes('Public Memory: Noise Control') &&
        value.bodyText.includes('68 noise control') &&
        value.bodyText.includes('Host one better public visit') &&
        value.bodyText.includes('Diagnose Objective') &&
        !value.bodyText.includes('Objective diagnostic') &&
        !value.bodyText.includes('Build Sky Garden');
      return repair && hasMemory && hasUi ? { ...value, repair } : null;
    });
    await clickButtonInCard(devtools, 'Public Memory: Noise Control', 'Diagnose Objective');
    const expanded = await waitFor('memory repair diagnostic expands', async () => {
      const value = await readMemoryRepairState(devtools);
      const hasUi =
        value.drawerOpen &&
        value.bodyText.includes('Public Memory: Noise Control') &&
        value.bodyText.includes('Objective diagnostic') &&
        value.bodyText.includes('Open Privacy Lens') &&
        value.bodyText.includes('Build Sky Garden');
      return hasUi ? value : null;
    });
    await clickButtonInCard(devtools, 'Public Memory: Noise Control', 'Open Privacy Lens');
    const lens = await waitFor('memory repair objective opens privacy lens', async () => {
      const value = await devtools.evaluate(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  const snapshot = actions.createSnapshot();
  return snapshot.view.lensMode === 'privacy' ? { lensMode: snapshot.view.lensMode } : null;
})()
`);
      return value;
    });
    await clickButton(devtools, 'Contracts');
    await clickButtonInCard(devtools, 'Public Memory: Noise Control', 'Build Sky Garden');
    const buildTool = await waitFor('memory repair objective selects build tool', async () => {
      const value = await devtools.evaluate(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  const snapshot = actions.createSnapshot();
  return snapshot.view.lensMode === 'normal' && snapshot.view.selectedTool === 'skyGarden'
    ? { lensMode: snapshot.view.lensMode, selectedTool: snapshot.view.selectedTool }
    : null;
})()
`);
      return value;
    });
    process.stdout.write(`${JSON.stringify({ url, state, expanded, lens, buildTool }, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
