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
  const snapshot = actions.createSnapshot();
  const counts = {};
  for (const room of snapshot.tower.rooms) counts[room.type] = (counts[room.type] ?? 0) + 1;
  return {
    phase: document.body.textContent?.includes('Break Ground') ? 'menu' : 'playing',
    counts,
    elevators: snapshot.tower.elevators.length,
    funds: snapshot.economy.funds,
    lensMode: snapshot.view.lensMode,
    selectedTool: snapshot.view.selectedTool,
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

async function touchDragGrid(devtools, start, end) {
  const startPoint = await gridPoint(devtools, start.gx, start.gy);
  const endPoint = await gridPoint(devtools, end.gx, end.gy);
  if (!startPoint || !endPoint) throw new Error('Could not resolve grid drag coordinates');

  await devtools.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startPoint.x, y: startPoint.y, id: 1, radiusX: 4, radiusY: 4 }],
  });
  await devtools.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: endPoint.x, y: endPoint.y, id: 1, radiusX: 4, radiusY: 4 }],
  });
  await devtools.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

async function waitForSnapshot(devtools, description, predicate) {
  return waitFor(description, async () => {
    const snapshot = await readSnapshot(devtools);
    return predicate(snapshot) ? snapshot : null;
  });
}

async function main() {
  await withDevPage('/reach-for-the-sky/?skip-intro=1', async ({ url, devtools }) => {
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await devtools.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await devtools.send('Page.navigate', { url });

    await waitFor('mobile start screen', async () => {
      const ready = await devtools.evaluate(
        `document.body.textContent?.includes('Break Ground') ?? false`,
      );
      return ready ? true : null;
    });
    await clickButton(devtools, 'Break Ground');
    await waitForSnapshot(
      devtools,
      'mobile playing phase',
      (snapshot) => snapshot.phase === 'playing',
    );

    await clickButton(devtools, 'Lobby');
    await touchDragGrid(devtools, { gx: -2, gy: 0 }, { gx: 2, gy: 0 });
    await waitForSnapshot(
      devtools,
      'mobile lobby committed',
      (snapshot) => snapshot.counts.lobby >= 5,
    );

    await clickButton(devtools, 'Floor');
    await touchDragGrid(devtools, { gx: -2, gy: 1 }, { gx: 2, gy: 1 });
    await waitForSnapshot(
      devtools,
      'mobile floor committed',
      (snapshot) => snapshot.counts.floor >= 5,
    );

    await clickButton(devtools, 'Office');
    await touchDragGrid(devtools, { gx: -2, gy: 1 }, { gx: -1, gy: 1 });
    const built = await waitForSnapshot(
      devtools,
      'mobile office committed',
      (snapshot) => snapshot.counts.office >= 1,
    );

    process.stdout.write(`${JSON.stringify({ url, mobileBuild: built }, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
