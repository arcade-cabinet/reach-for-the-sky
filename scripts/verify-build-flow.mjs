import { waitFor, withDevPage } from './browser-smoke-harness.mjs';

const CELL_WIDTH = 32;
const CELL_HEIGHT = 24;

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

async function readSnapshot(devtools) {
  return devtools.evaluate(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  const { gameWorld } = await import('/reach-for-the-sky/src/state/world.ts');
  const { InspectionTrait } = await import('/reach-for-the-sky/src/state/traits.ts');
  const snapshot = actions.createSnapshot();
  const inspection = gameWorld.get(InspectionTrait);
  const counts = {};
  for (const room of snapshot.tower.rooms) counts[room.type] = (counts[room.type] ?? 0) + 1;
  return {
    phase: document.body.textContent?.includes('Break Ground') ? 'menu' : 'playing',
    counts,
    elevators: snapshot.tower.elevators.length,
    shafts: snapshot.tower.shafts.length,
    funds: snapshot.economy.funds,
    tutorialStep: snapshot.view.tutorialStep,
    lensMode: snapshot.view.lensMode,
    campaignAct: snapshot.campaign.act,
    inspectionKind: inspection?.selection?.kind ?? null,
    inspectionTitle: inspection?.selection?.title ?? null,
  };
})()
`);
}

async function gridPoint(devtools, gx, gy) {
  return devtools.evaluate(`
(async () => {
  const { gameWorld } = await import('/reach-for-the-sky/src/state/world.ts');
  const { ViewTrait } = await import('/reach-for-the-sky/src/state/traits.ts');
  const view = gameWorld.get(ViewTrait);
  const host = document.querySelector('.canvas-host');
  if (!view || !host) return null;
  const rect = host.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 + view.panX + ${gx} * ${CELL_WIDTH} * view.zoom,
    y: rect.top + rect.height / 2 + view.panY - ${gy} * ${CELL_HEIGHT} * view.zoom,
  };
})()
`);
}

async function dragGrid(devtools, start, end) {
  const startPoint = await gridPoint(devtools, start.gx, start.gy);
  const endPoint = await gridPoint(devtools, end.gx, end.gy);
  if (!startPoint || !endPoint) throw new Error('Could not resolve grid drag coordinates');

  await devtools.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: startPoint.x,
    y: startPoint.y,
    button: 'none',
  });
  await devtools.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: startPoint.x,
    y: startPoint.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await devtools.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: endPoint.x,
    y: endPoint.y,
    button: 'left',
    buttons: 1,
  });
  await devtools.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: endPoint.x,
    y: endPoint.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
}

async function clickGrid(devtools, cell) {
  const point = await gridPoint(devtools, cell.gx, cell.gy);
  if (!point) throw new Error('Could not resolve grid click coordinates');
  await devtools.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: point.x,
    y: point.y,
    button: 'none',
  });
  await devtools.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: point.x,
    y: point.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await devtools.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
}

async function waitForSnapshot(devtools, description, predicate) {
  let latest = null;
  return waitFor(description, async () => {
    const snapshot = await readSnapshot(devtools);
    latest = snapshot;
    return predicate(snapshot) ? snapshot : null;
  }).catch((error) => {
    throw new Error(`${error.message}; latest snapshot: ${JSON.stringify(latest)}`);
  });
}

async function waitForAutosave(devtools) {
  return waitFor(
    'build autosave persisted',
    async () =>
      devtools.evaluate(`
(async () => {
  const repository = await import('/reach-for-the-sky/src/persistence/saveRepository.ts');
  const snapshot = await repository.loadSnapshot(repository.DEFAULT_SAVE_SLOT);
  const history = await repository.listSimulationEvents(40);
  const autosaveEvents = history.filter((event) => event.eventType === 'autosave');
  if (!snapshot || snapshot.tower.rooms.length < 25 || snapshot.tower.elevators.length < 1) {
    return null;
  }
  return {
    day: snapshot.clock.day,
    act: snapshot.campaign.act,
    roomCount: snapshot.tower.rooms.length,
    elevators: snapshot.tower.elevators.length,
    tutorialStep: snapshot.view.tutorialStep,
    autosaveEvents: autosaveEvents.length,
    latestReason: autosaveEvents[0]?.data?.reason ?? null,
  };
})()
`),
    15_000,
  );
}

async function main() {
  await withDevPage('/reach-for-the-sky/', async ({ url, devtools }) => {
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 820,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await devtools.send('Page.navigate', { url });

    await waitFor('start screen', async () => {
      const ready = await devtools.evaluate(
        `document.body.textContent?.includes('Break Ground') ?? false`,
      );
      return ready ? true : null;
    });
    await clickButton(devtools, 'Break Ground');
    await waitForSnapshot(devtools, 'playing phase', (snapshot) => snapshot.phase === 'playing');

    await clickButton(devtools, 'Lobby');
    await dragGrid(devtools, { gx: -3, gy: 0 }, { gx: 3, gy: 0 });
    await waitForSnapshot(devtools, 'lobby committed', (snapshot) => snapshot.counts.lobby >= 7);

    await clickButton(devtools, 'Floor');
    await dragGrid(devtools, { gx: -3, gy: 1 }, { gx: 3, gy: 2 });
    await waitForSnapshot(
      devtools,
      'floor bays committed',
      (snapshot) => snapshot.counts.floor >= 14,
    );

    await clickButton(devtools, 'Office');
    await dragGrid(devtools, { gx: -3, gy: 1 }, { gx: -2, gy: 1 });
    await waitForSnapshot(devtools, 'office committed', (snapshot) => snapshot.counts.office >= 1);

    await clickButton(devtools, 'Elevator');
    await dragGrid(devtools, { gx: 0, gy: 0 }, { gx: 0, gy: 2 });
    const built = await waitForSnapshot(
      devtools,
      'elevator committed',
      (snapshot) => snapshot.elevators >= 1 && snapshot.tutorialStep >= 4,
    );
    const autosave = await waitForAutosave(devtools);

    await clickButton(devtools, 'Maintenance');
    const maintenance = await waitForSnapshot(
      devtools,
      'maintenance lens active',
      (snapshot) => snapshot.lensMode === 'maintenance',
    );
    await clickButton(devtools, 'Transit');
    const transit = await waitForSnapshot(
      devtools,
      'transit lens active',
      (snapshot) => snapshot.lensMode === 'transit',
    );
    await clickButton(devtools, 'Sentiment');
    const sentiment = await waitForSnapshot(
      devtools,
      'sentiment lens active',
      (snapshot) => snapshot.lensMode === 'sentiment',
    );
    await clickButton(devtools, 'Privacy');
    const privacy = await waitForSnapshot(
      devtools,
      'privacy lens active',
      (snapshot) => snapshot.lensMode === 'privacy',
    );
    await clickButton(devtools, 'Safety');
    const safety = await waitForSnapshot(
      devtools,
      'safety lens active',
      (snapshot) => snapshot.lensMode === 'safety',
    );
    await clickButton(devtools, 'Events');
    const event = await waitForSnapshot(
      devtools,
      'event lens active',
      (snapshot) => snapshot.lensMode === 'event',
    );
    const stats = await waitFor('lens render recorded', async () => {
      const value = await devtools.evaluate('window.reachForTheSkyRenderer?.getStats?.() ?? null');
      return value?.lensBaseDraws >= 1 ? value : null;
    });
    await clickButton(devtools, 'Normal');
    await waitForSnapshot(
      devtools,
      'normal lens active',
      (snapshot) => snapshot.lensMode === 'normal',
    );
    await clickGrid(devtools, { gx: -2, gy: 1 });
    const inspection = await waitForSnapshot(
      devtools,
      'room inspection active',
      (snapshot) => snapshot.inspectionKind === 'room',
    );

    process.stdout.write(
      `${JSON.stringify(
        {
          url,
          build: built,
          autosave,
          lenses: { maintenance, transit, sentiment, privacy, safety, event },
          inspection,
          stats,
        },
        null,
        2,
      )}\n`,
    );
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
