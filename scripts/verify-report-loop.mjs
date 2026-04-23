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

async function setSimulationSpeed(devtools, speed) {
  await devtools.evaluate(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  actions.setSpeed(${Number(speed)});
})()
`);
}

async function readDailyReportState(devtools) {
  return devtools.evaluate(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  const repository = await import('/reach-for-the-sky/src/persistence/saveRepository.ts');
  const snapshot = actions.createSnapshot();
  const history = await repository.listSimulationEvents(100);
  const autosave = await repository.loadSnapshot(repository.DEFAULT_SAVE_SLOT);
  const saveSlots = await repository.listSaveSlots();
  const autosaveSummary = saveSlots.find((slot) => slot.slotId === repository.DEFAULT_SAVE_SLOT);
  const liveHistory = history.filter((event) => event.data?.source === 'tick');
  const liveEventTypes = liveHistory.map((event) => event.eventType);
  if (
    snapshot.campaign.reports.length === 0 ||
    !liveEventTypes.includes('rent') ||
    !liveEventTypes.includes('daily-report') ||
    !autosave ||
    autosave.campaign.reports.length === 0 ||
    !autosaveSummary
  ) {
    return null;
  }
  return {
    events: liveEventTypes,
    history: liveHistory,
    autosave: {
      day: autosave.clock.day,
      act: autosave.campaign.act,
      reports: autosave.campaign.reports.length,
      roomCount: autosave.tower.rooms.length,
      summary: autosaveSummary,
    },
    report: snapshot.campaign.reports[0],
    day: snapshot.clock.day,
    hour: Math.floor((snapshot.clock.tick / 2000) * 24),
    funds: snapshot.economy.funds,
    dailyRevenue: snapshot.economy.dailyRevenue,
    tenantSatisfaction: snapshot.economy.tenantSatisfaction,
    publicTrust: snapshot.macro.publicTrust,
    reputation: snapshot.campaign.reputation,
  };
})()
`);
}

async function main() {
  await withDevPage('/reach-for-the-sky/?scenario=opening', async ({ url, devtools }) => {
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await devtools.send('Page.navigate', { url });

    await waitFor('opening scenario UI', async () => {
      const ready = await devtools.evaluate(`
(() => {
  const stats = window.reachForTheSkyRenderer?.getStats?.() ?? null;
  const text = document.body.textContent ?? '';
  return stats?.frames >= 2 && text.includes('City brief') && text.includes('Opening contract') ? true : null;
})()
`);
      return ready;
    });

    await setSimulationSpeed(devtools, 4);
    const simulation = await waitFor(
      'daily report generated and persisted by live tick loop',
      () => readDailyReportState(devtools),
      35_000,
    );
    await setSimulationSpeed(devtools, 0);

    if (!simulation.events.includes('rent')) throw new Error('Report loop did not collect rent');
    if (!simulation.events.includes('daily-report')) {
      throw new Error('Report loop did not emit daily-report');
    }
    if (!simulation.report.title.includes('Operations Brief')) {
      throw new Error(`Unexpected report title: ${simulation.report.title}`);
    }
    if (simulation.report.revenue <= 0) throw new Error('Daily report did not capture revenue');
    if (simulation.report.costs <= 0) throw new Error('Daily report did not capture costs');
    if (!Number.isFinite(simulation.report.netRevenue)) {
      throw new Error('Daily report did not capture net revenue');
    }
    if (simulation.report.nextRisks.length === 0) {
      throw new Error('Daily report has no next-risk signals');
    }
    if (simulation.report.notes.length === 0)
      throw new Error('Daily report has no diagnosis notes');
    const historyTypes = simulation.history.map((event) => event.eventType);
    if (!historyTypes.includes('rent')) throw new Error('SQLite history did not record rent');
    if (!historyTypes.includes('daily-report')) {
      throw new Error('SQLite history did not record daily-report');
    }
    if (simulation.autosave.reports === 0) throw new Error('Autosave did not persist report state');
    if (simulation.autosave.roomCount < 50)
      throw new Error('Autosave tower snapshot is incomplete');

    await clickButton(devtools, 'Contracts');
    const ui = await waitFor(
      'daily report visible in contracts drawer',
      async () => {
        const value = await devtools.evaluate(`
(() => {
  const text = document.body.textContent ?? '';
  const card = document.querySelector('.daily-report-card');
  return card && text.includes(${JSON.stringify(simulation.report.title)})
        ? {
            visible: true,
            cardText: card.textContent,
            bodyHasRevenue:
              text.includes('Trust') &&
              text.includes('Rep') &&
              text.includes('Costs') &&
              text.includes('Next risks'),
          }
        : null;
})()
`);
        return value;
      },
      15_000,
    );

    if (!ui.bodyHasRevenue) throw new Error('Daily report UI is missing trust/reputation digest');

    await clickButton(devtools, 'Settings');
    const diagnostics = await waitFor(
      'SQLite event diagnostics visible in settings drawer',
      async () => {
        const value = await devtools.evaluate(`
(() => {
  const panel = document.querySelector('.diagnostics-panel');
  if (!panel) return null;
  const text = panel.textContent ?? '';
  return text.includes('Diagnostics') &&
    text.includes('v1.0.0') &&
    text.includes('Export Debug Bundle') &&
    text.includes('Daily Report') &&
    text.includes('Rent')
    ? { visible: true, text }
    : null;
})()
`);
        return value;
      },
      15_000,
    );

    process.stdout.write(
      `${JSON.stringify(
        {
          url,
          simulation,
          ui,
          diagnostics,
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
