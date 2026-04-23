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

async function advanceVisitLifecycle(devtools) {
  return devtools.evaluateAwaited(`
(async () => {
  try {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  const repository = await import('/reach-for-the-sky/src/persistence/saveRepository.ts');
  const withWriteRetry = async (work) => {
    let lastError;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await work();
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 75 + attempt * 50));
      }
    }
    throw lastError;
  };
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
  const seen = [];
  const phases = [];
  actions.setSpeed(4);
  for (let index = 0; index < 1800; index += 1) {
    const events = actions.tickWorld();
    if (events.length > 0) {
      seen.push(...events);
      phases.push({
        tick: index,
        events,
        visits: actions.summarizeActivePublicVisits().map((visit) => ({
          label: visit.label,
          phaseLabel: visit.phaseLabel,
          spawnedAgents: visit.spawnedAgents,
          representativeCount: visit.representativeCount,
          mood: visit.mood,
          pressureReasons: visit.pressureReasons,
        })),
      });
    }
    const hasArrival = seen.includes('visit-arrival');
    const hasSpend = seen.includes('visit-spend');
    const hasDeparture = seen.includes('visit-departure');
    const hasOutcome = seen.some((event) =>
      event === 'visit-success' || event === 'visit-failure' || event === 'visit-neutral',
    );
    if (hasArrival && hasSpend && hasDeparture && hasOutcome) break;
  }
  actions.setSpeed(0);
  const snapshot = actions.createSnapshot();
  const context = createContext(snapshot, 'visit-lifecycle-smoke');
  await withWriteRetry(() => repository.recordSimulationEvents(seen, context));
  await withWriteRetry(() => repository.saveSnapshot(snapshot, repository.DEFAULT_SAVE_SLOT));
  await withWriteRetry(() => repository.recordSimulationEvent('autosave', {
    ...context,
    reason: 'visit-lifecycle',
    events: seen,
  }));
  const history = await withWriteRetry(() => repository.listSimulationEvents(120));
  const autosave = await withWriteRetry(() => repository.loadSnapshot(repository.DEFAULT_SAVE_SLOT));
  return {
    seen,
    phases,
    snapshot: {
      day: snapshot.clock.day,
      hour: Math.floor((snapshot.clock.tick / 2000) * 24),
      visits: snapshot.tower.visits.length,
      memories: snapshot.tower.visitMemories.map((memory) => ({
        label: memory.label,
        outcome: memory.outcome,
        sentiment: memory.sentiment,
        pressureReasons: memory.pressureReasons,
      })),
      successfulVisits: snapshot.campaign.successfulVisits,
      failedVisits: snapshot.campaign.failedVisits,
      publicTrust: snapshot.macro.publicTrust,
      activeContracts: snapshot.campaign.activeContracts.map((contract) => ({
        title: contract.title,
        source: contract.source ?? null,
        score: contract.score,
      })),
    },
    history: history.map((event) => ({ eventType: event.eventType, source: event.data?.source ?? null })),
    autosave: {
      visits: autosave?.tower.visits.length ?? null,
      memories: autosave?.tower.visitMemories.length ?? null,
      successfulVisits: autosave?.campaign.successfulVisits ?? null,
      failedVisits: autosave?.campaign.failedVisits ?? null,
    },
  };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    };
  }
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
    await devtools.evaluateAwaited(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  actions.setSpeed(0);
})()
`);
    await clickButton(devtools, 'Contracts');
    await clickButton(devtools, 'Invite Public Visit');
    await waitFor('active public visit commitment visible', async () => {
      const text = await devtools.evaluate(`document.body.textContent ?? ''`);
      return text.includes('Active commitment') &&
        text.includes('Personality') &&
        text.includes('Dealbreakers') &&
        text.includes('Yuka hosting plan') &&
        text.includes('Protect now')
        ? true
        : null;
    });

    const lifecycle = await advanceVisitLifecycle(devtools);
    if (lifecycle?.error) {
      throw new Error(
        `Lifecycle browser execution failed: ${lifecycle.error}\n${lifecycle.stack ?? ''}`,
      );
    }
    if (!lifecycle || !Array.isArray(lifecycle.seen)) {
      throw new Error(`Lifecycle returned no event list: ${JSON.stringify(lifecycle)}`);
    }
    const required = ['visit-arrival', 'visit-spend', 'visit-departure'];
    for (const eventType of required) {
      if (!lifecycle.seen.includes(eventType)) throw new Error(`Lifecycle missed ${eventType}`);
    }
    if (
      !lifecycle.seen.some((eventType) =>
        ['visit-success', 'visit-failure', 'visit-neutral'].includes(eventType),
      )
    ) {
      throw new Error('Lifecycle did not resolve to a public outcome');
    }
    if (lifecycle.snapshot.visits !== 0) throw new Error('Resolved visit remained active');
    if (lifecycle.snapshot.memories.length === 0) throw new Error('Visit did not create memory');
    if (lifecycle.snapshot.memories[0].pressureReasons.length === 0) {
      throw new Error('Visit memory did not retain pressure reasons');
    }
    if (lifecycle.autosave?.memories === 0) throw new Error('Autosave did not persist memory');
    const historyTypes = lifecycle.history
      .filter((event) => event.source === 'visit-lifecycle-smoke')
      .map((event) => event.eventType);
    for (const eventType of required) {
      if (!historyTypes.includes(eventType)) {
        throw new Error(`SQLite history missed ${eventType}`);
      }
    }

    const drawerOpen = await devtools.evaluate(
      `Boolean(document.querySelector('.contracts-drawer'))`,
    );
    if (!drawerOpen) await clickButton(devtools, 'Contracts');
    const ui = await waitFor('public memory visible after visit lifecycle', async () => {
      const value = await devtools.evaluate(`
(() => {
  const text = document.body.textContent ?? '';
  return text.includes('Public memory') &&
    text.includes('Latest public story') &&
    text.includes('Bottleneck') &&
    text.includes('Open Transit Lens') &&
    text.includes('Repair objective') &&
    text.includes('Remembered profile') &&
    text.includes('Dealbreakers') &&
    text.includes(${JSON.stringify(lifecycle.snapshot.memories[0].label)}) &&
    !text.includes('Active commitment')
      ? { text }
      : null;
})()
`);
      return value;
    });

    process.stdout.write(
      `${JSON.stringify({ url, lifecycle, ui: { visible: Boolean(ui) } }, null, 2)}\n`,
    );
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
