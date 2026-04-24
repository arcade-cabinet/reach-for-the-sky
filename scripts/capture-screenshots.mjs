import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { waitFor, withDevPage } from './browser-smoke-harness.mjs';

const shots = [
  {
    name: 'reach-sky-settings-desktop.png',
    width: 1440,
    height: 900,
    mobile: false,
  },
  {
    name: 'reach-sky-settings-mobile.png',
    width: 390,
    height: 844,
    mobile: true,
  },
  {
    // Landing-page "opening-mobile" preview source. Same scenario URL, mobile
    // viewport — gives us a canonical 390x844 capture matching the one in
    // public/assets/previews/ so the thumbnail stays current.
    name: 'reach-sky-opening-mobile.png',
    width: 390,
    height: 844,
    mobile: true,
  },
];

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

async function waitForRenderedScenario(devtools) {
  await waitFor(
    'rendered opening scenario',
    async () => {
      const stats = await devtools.evaluate(`
(() => {
  const stats = window.reachForTheSkyRenderer?.getStats?.() ?? null;
  const hasCanvas = Boolean(document.querySelector('.game-canvas'));
  return hasCanvas && stats?.frames >= 2 ? stats : null;
})()
`);
      return stats;
    },
    45_000,
  );
}

async function clickButton(devtools, label) {
  const clicked = await devtools.evaluate(buttonExpression(label));
  if (!clicked) throw new Error(`Could not find ${label} button`);
}

async function generateDailyReport(devtools) {
  const result = await waitFor(
    'daily report generated',
    async () =>
      devtools.evaluate(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  const repository = await import('/reach-for-the-sky/src/persistence/saveRepository.ts');
  const createContext = (snapshot, source) => ({
    source,
    day: snapshot.clock.day,
    tick: snapshot.clock.tick,
    hour: Math.floor((snapshot.clock.tick / 2000) * 24),
    funds: snapshot.economy.funds,
    population: snapshot.economy.population,
    act: snapshot.campaign.act,
    mode: snapshot.campaign.mode,
    victory: snapshot.campaign.victory,
    identity: snapshot.campaign.towerIdentity,
    declaredIdentity: snapshot.campaign.declaredIdentity,
    roomCount: snapshot.tower.rooms.length,
    activeContracts: snapshot.campaign.activeContracts.map((contract) => contract.id),
    successfulVisits: snapshot.campaign.successfulVisits,
    failedVisits: snapshot.campaign.failedVisits,
  });
  actions.setSpeed(4);
  for (let index = 0; index < 40; index += 1) {
    const events = actions.tickWorld();
    const snapshot = actions.createSnapshot();
    if (events.length > 0) {
      await repository.recordSimulationEvents(events, createContext(snapshot, 'screenshot'));
    }
    if (snapshot.campaign.reports.length > 0) {
      await repository.saveSnapshot(snapshot, repository.DEFAULT_SAVE_SLOT);
      await repository.recordSimulationEvent('autosave', {
        ...createContext(snapshot, 'autosave'),
        reason: 'daily-report',
        events: ['daily-report'],
      });
      actions.setSpeed(0);
      return {
        ticks: index + 1,
        events,
        title: snapshot.campaign.reports[0].title,
      };
    }
  }
  return null;
})()
`),
    30_000,
  );
  await waitFor('daily report visible', async () =>
    devtools.evaluate(`
(() => {
  const card = document.querySelector('.daily-report-card');
  if (!card) return null;
  const drawer = document.querySelector('.contracts-drawer');
  if (drawer) drawer.scrollTop = card.getBoundingClientRect().top + drawer.scrollTop - 220;
  return card.textContent?.includes(${JSON.stringify(result.title)}) ? true : null;
})()
`),
  );
  return result;
}

async function advanceVisitLifecycleForScreenshot(devtools) {
  await devtools.evaluate(`
(function () {
  window.__reachVisitLifecycle = { done: false, error: null, seen: [] };
  import('/reach-for-the-sky/src/state/actions.ts')
    .then((actions) => {
      let chunks = 0;
      actions.setSpeed(4);
      const timer = window.setInterval(() => {
        try {
          for (let index = 0; index < 80; index += 1) {
            window.__reachVisitLifecycle.seen.push(...actions.tickWorld());
          }
          chunks += 1;
          const seen = window.__reachVisitLifecycle.seen;
          const resolved =
            seen.includes('visit-spend') &&
            seen.includes('visit-departure') &&
            seen.some((event) =>
              ['visit-success', 'visit-failure', 'visit-neutral'].includes(event),
            );
          if (resolved || chunks >= 32) {
            actions.setSpeed(0);
            window.clearInterval(timer);
            window.__reachVisitLifecycle.done = true;
          }
        } catch (error) {
          actions.setSpeed(0);
          window.clearInterval(timer);
          window.__reachVisitLifecycle.error =
            error instanceof Error ? error.message : String(error);
          window.__reachVisitLifecycle.done = true;
        }
      }, 0);
    })
    .catch((error) => {
      window.__reachVisitLifecycle.error =
        error instanceof Error ? error.message : String(error);
      window.__reachVisitLifecycle.done = true;
    });
  return true;
})()
`);
  const result = await waitFor(
    'visit lifecycle advanced for screenshot',
    async () =>
      devtools.evaluate(`
(() => {
  const state = window.__reachVisitLifecycle;
  if (!state?.done) return null;
  return { error: state.error, seen: state.seen };
})()
`),
    30_000,
  );
  if (result.error) throw new Error(`Screenshot lifecycle advance failed: ${result.error}`);
  return result.seen;
}

async function capture(devtools, outDir, name) {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
  const result = await devtools.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const pathname = resolve(outDir, name);
  await writeFile(pathname, Buffer.from(result.data, 'base64'));
  return pathname;
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

async function holdGridDrag(devtools, start, end) {
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
  return endPoint;
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

async function releaseMouse(devtools, point) {
  await devtools.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
}

async function main() {
  const outDir = resolve('test-screenshots');
  await mkdir(outDir, { recursive: true });

  await withDevPage('/reach-for-the-sky/?scenario=opening', async ({ url, devtools }) => {
    const captures = [];
    const menuUrl = url.replace('?scenario=opening', '');
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await devtools.send('Page.navigate', { url: menuUrl });
    await waitFor('rendered start menu', async () =>
      devtools.evaluate(`
(() => {
  const text = document.body.textContent ?? '';
  const previewCount = Array.from(document.querySelectorAll('.start-scenario-card img')).filter(
    (image) => image.complete && image.naturalWidth > 0,
  ).length;
  return text.includes('Break Ground') && previewCount >= 4 ? true : null;
})()
`),
    );
    captures.push(await capture(devtools, outDir, 'reach-sky-menu-desktop.png'));
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await devtools.send('Page.navigate', { url: menuUrl });
    // Force eager load on all scenario previews and scroll the page so
    // lazy-loaded below-the-fold cards decode before the assertion runs.
    // On narrow mobile viewports the scenario row lives below the fold
    // and otherwise never triggers the IntersectionObserver before the
    // harness times out.
    await waitFor('scenario cards mounted', async () =>
      devtools.evaluate(`
(() => {
  const images = Array.from(document.querySelectorAll('.start-scenario-card img'));
  if (images.length < 4) return null;
  for (const image of images) {
    image.loading = 'eager';
    image.decoding = 'sync';
  }
  window.scrollTo(0, document.body.scrollHeight);
  return true;
})()
`),
    );
    await waitFor('rendered mobile start menu', async () =>
      devtools.evaluate(`
(() => {
  const text = document.body.textContent ?? '';
  const previewCount = Array.from(document.querySelectorAll('.start-scenario-card img')).filter(
    (image) => image.complete && image.naturalWidth > 0,
  ).length;
  return text.includes('Break Ground') && previewCount >= 4 ? true : null;
})()
`),
    );
    captures.push(await capture(devtools, outDir, 'reach-sky-menu-mobile.png'));

    for (const shot of shots) {
      await devtools.send('Emulation.setDeviceMetricsOverride', {
        width: shot.width,
        height: shot.height,
        deviceScaleFactor: 1,
        mobile: shot.mobile,
      });
      await devtools.send('Page.navigate', { url });
      await waitForRenderedScenario(devtools);
      captures.push(await capture(devtools, outDir, shot.name));
    }

    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await clickButton(devtools, 'Contracts');
    captures.push(await capture(devtools, outDir, 'reach-sky-contracts-drawer-desktop.png'));
    await generateDailyReport(devtools);
    captures.push(await capture(devtools, outDir, 'reach-sky-daily-report-desktop.png'));
    await clickButton(devtools, 'Contracts');
    await clickButton(devtools, 'Settings');
    captures.push(await capture(devtools, outDir, 'reach-sky-settings-drawer-desktop.png'));

    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 820,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await devtools.send('Page.navigate', { url });
    await waitForRenderedScenario(devtools);
    await clickButton(devtools, 'Floor');
    const heldPoint = await holdGridDrag(devtools, { gx: -4, gy: 4 }, { gx: 4, gy: 4 });
    captures.push(await capture(devtools, outDir, 'reach-sky-build-ghost-desktop.png'));
    await releaseMouse(devtools, heldPoint);

    await devtools.send('Page.navigate', { url });
    await waitForRenderedScenario(devtools);
    await clickButton(devtools, 'Maintenance');
    captures.push(await capture(devtools, outDir, 'reach-sky-maintenance-lens-desktop.png'));
    await clickButton(devtools, 'Transit');
    captures.push(await capture(devtools, outDir, 'reach-sky-transit-lens-desktop.png'));
    await clickButton(devtools, 'Value');
    captures.push(await capture(devtools, outDir, 'reach-sky-value-lens-desktop.png'));
    await clickButton(devtools, 'Sentiment');
    captures.push(await capture(devtools, outDir, 'reach-sky-sentiment-lens-desktop.png'));
    await clickButton(devtools, 'Privacy');
    captures.push(await capture(devtools, outDir, 'reach-sky-privacy-lens-desktop.png'));
    await clickButton(devtools, 'Safety');
    captures.push(await capture(devtools, outDir, 'reach-sky-safety-lens-desktop.png'));
    await clickButton(devtools, 'Events');
    captures.push(await capture(devtools, outDir, 'reach-sky-event-lens-desktop.png'));
    await clickButton(devtools, 'Normal');
    await clickGrid(devtools, { gx: -4, gy: 1 });
    captures.push(await capture(devtools, outDir, 'reach-sky-inspection-desktop.png'));

    const skylineUrl = url.replace('scenario=opening', 'scenario=skyline');
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await devtools.send('Page.navigate', { url: skylineUrl });
    await waitForRenderedScenario(devtools);
    await clickButton(devtools, 'Contracts');
    captures.push(await capture(devtools, outDir, 'reach-sky-skyline-victory-desktop.png'));
    await devtools.evaluate(`
(() => {
  const drawer = document.querySelector('.contracts-drawer');
  if (drawer) drawer.scrollTop = drawer.scrollHeight;
})()
`);
    captures.push(await capture(devtools, outDir, 'reach-sky-public-memory-desktop.png'));

    const weatherUrl = url.replace('scenario=opening', 'scenario=weather');
    await devtools.send('Page.navigate', { url: weatherUrl });
    await waitForRenderedScenario(devtools);
    captures.push(await capture(devtools, outDir, 'reach-sky-weather-stress-desktop.png'));

    const recoveryUrl = url.replace('scenario=opening', 'scenario=recovery');
    await devtools.send('Page.navigate', { url: recoveryUrl });
    await waitForRenderedScenario(devtools);
    await clickButton(devtools, 'Contracts');
    await waitFor(
      'recovery contract objective diagnostic toggle visible for screenshot',
      async () =>
        devtools.evaluate(`
(() => {
  const drawer = document.querySelector('.contracts-drawer');
  const text = document.body.textContent ?? '';
  if (drawer) {
    const repair = Array.from(document.querySelectorAll('.contract-card')).find((card) =>
      card.textContent?.includes('Public Memory: Noise Control'),
    );
    if (repair) drawer.scrollTop = repair.getBoundingClientRect().top + drawer.scrollTop - 120;
  }
  return text.includes('Public Memory: Noise Control') &&
    text.includes('Diagnose Objective')
    ? true
    : null;
})()
`),
    );
    await devtools.evaluate(`
(() => {
  const repair = Array.from(document.querySelectorAll('.contract-card')).find((card) =>
    card.textContent?.includes('Public Memory: Noise Control'),
  );
  const button = repair
    ? Array.from(repair.querySelectorAll('button')).find((candidate) =>
        candidate.textContent?.trim().startsWith('Diagnose Objective'),
      )
    : null;
  button?.click();
})()
`);
    await waitFor('recovery contract objective diagnostics visible for screenshot', async () =>
      devtools.evaluate(`
(() => {
  const text = document.body.textContent ?? '';
  return text.includes('Public Memory: Noise Control') &&
    text.includes('Objective diagnostic') &&
    text.includes('Build Sky Garden')
    ? true
    : null;
})()
`),
    );
    captures.push(await capture(devtools, outDir, 'reach-sky-recovery-contract-desktop.png'));
    await clickButton(devtools, 'Invite Public Visit');
    await waitFor('invited visit visible for screenshot', async () =>
      devtools.evaluate(`
(() => {
  const drawer = document.querySelector('.contracts-drawer');
  const text = document.body.textContent ?? '';
  if (drawer) {
    const visitDocket = Array.from(document.querySelectorAll('.drawer-section')).find((section) =>
      section.textContent?.includes('Visit docket'),
    );
    if (visitDocket) drawer.scrollTop = visitDocket.getBoundingClientRect().top + drawer.scrollTop - 140;
  }
  return text.includes('invited') && text.includes('inquiry') ? true : null;
})()
`),
    );
    captures.push(await capture(devtools, outDir, 'reach-sky-invite-visit-desktop.png'));
    await advanceVisitLifecycleForScreenshot(devtools);
    await waitFor('resolved visit memory visible for screenshot', async () =>
      devtools.evaluate(`
(() => {
  const drawer = document.querySelector('.contracts-drawer');
  const text = document.body.textContent ?? '';
  if (drawer) {
    const memory = Array.from(document.querySelectorAll('.drawer-section')).find((section) =>
      section.textContent?.includes('Latest public story'),
    );
    if (memory) drawer.scrollTop = memory.getBoundingClientRect().top + drawer.scrollTop - 120;
  }
  return text.includes('Foreign prince and retainers') &&
    text.includes('Public Memory: Queue Story') &&
    text.includes('Latest public story') &&
    text.includes('Bottleneck') &&
    text.includes('Open Transit Lens') &&
    text.includes('Repair objective') &&
    text.includes('Public memory')
    ? true
    : null;
})()
`),
    );
    captures.push(await capture(devtools, outDir, 'reach-sky-visit-lifecycle-desktop.png'));
    await clickButton(devtools, 'Inspect Focus');
    await waitFor('public story inspection focus visible for screenshot', async () =>
      devtools.evaluate(`
(() => {
  const text = document.body.textContent ?? '';
  return text.includes('Public story focus') &&
    text.includes('Foreign prince and retainers') &&
    text.includes('Open transit lens')
    ? true
    : null;
})()
`),
    );
    captures.push(await capture(devtools, outDir, 'reach-sky-public-story-inspection-desktop.png'));
    process.stdout.write(`${JSON.stringify({ captures }, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
