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

async function readInviteState(devtools) {
  return devtools.evaluateAwaited(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  const repository = await import('/reach-for-the-sky/src/persistence/saveRepository.ts');
  const snapshot = actions.createSnapshot();
  const forecast = actions.forecastPublicVisitInvite();
  const activeReadiness = actions.summarizeActivePublicVisits();
  const history = await repository.listSimulationEvents(40);
  const autosave = await repository.loadSnapshot(repository.DEFAULT_SAVE_SLOT);
  return {
    forecast,
    activeReadiness,
    visits: snapshot.tower.visits.map((visit) => ({
      label: visit.label,
      status: visit.status,
      targetRoomId: visit.targetRoomId,
      arrivalHour: visit.arrivalHour,
      mood: visit.memory.outcome,
      pressureReasons: visit.memory.pressureReasons,
    })),
    activeContracts: snapshot.campaign.activeContracts.map((contract) => ({
      title: contract.title,
      source: contract.source ?? null,
    })),
    topMetrics: Array.from(document.querySelectorAll('.top-metrics article')).map(
      (article) => article.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
    ),
    bodyText: document.body.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
    history: history.map((event) => ({ eventType: event.eventType, source: event.data?.source ?? null })),
    autosaveVisits: autosave?.tower.visits.length ?? 0,
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
    const forecast = await waitFor(
      'public hosting forecast visible',
      async () => {
        const value = await readInviteState(devtools);
        const hasForecast =
          value.forecast.canInvite &&
          typeof value.forecast.label === 'string' &&
          typeof value.forecast.targetRoomId === 'string' &&
          value.forecast.behavior?.dealbreakers?.length > 0 &&
          value.forecast.hostingPlan?.priorities?.length > 0 &&
          value.bodyText.includes('Hosting forecast') &&
          value.bodyText.includes('Personality') &&
          value.bodyText.includes('Dealbreakers') &&
          value.bodyText.includes('Yuka hosting plan') &&
          value.bodyText.includes('Fix first');
        return hasForecast ? value.forecast : null;
      },
      20_000,
    );
    await clickButton(devtools, 'Invite Public Visit');
    const state = await waitFor(
      'invited public visit visible and persisted',
      async () => {
        const value = await readInviteState(devtools);
        const visit = value.visits[0];
        const readiness = value.activeReadiness[0];
        const hasVisit = visit?.status === 'inquiry' && typeof visit.targetRoomId === 'string';
        const matchesForecast =
          visit?.label === forecast.label &&
          readiness?.label === forecast.label &&
          readiness?.phaseLabel === 'Accepted inquiry';
        const hasMetric = value.topMetrics.some((text) => text === 'Visits1');
        const hasReactiveContract = value.activeContracts.some(
          (contract) => contract.source === 'visit',
        );
        const hasUi =
          value.bodyText.includes('invited') &&
          value.bodyText.includes('inquiry') &&
          value.bodyText.includes('Active commitment') &&
          value.bodyText.includes('Personality') &&
          value.bodyText.includes('Dealbreakers') &&
          value.bodyText.includes('Yuka hosting plan') &&
          value.bodyText.includes('Protect now') &&
          value.bodyText.includes('Next invite forecast');
        const persisted =
          value.history.some(
            (event) =>
              event.eventType === 'visit-inquiry' && event.source === 'invite-public-visit',
          ) && value.autosaveVisits === 1;
        return hasVisit && matchesForecast && hasMetric && hasReactiveContract && hasUi && persisted
          ? value
          : null;
      },
      20_000,
    );
    process.stdout.write(`${JSON.stringify({ url, state }, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
