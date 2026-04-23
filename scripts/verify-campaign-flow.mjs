import { waitFor, withDevPage } from './browser-smoke-harness.mjs';

async function readCampaignSnapshot(devtools) {
  return devtools.evaluate(`
(async () => {
  const actions = await import('/reach-for-the-sky/src/state/actions.ts');
  const snapshot = actions.createSnapshot();
  return {
    act: snapshot.campaign.act,
    victory: snapshot.campaign.victory,
	    mode: snapshot.campaign.mode,
	    declaredIdentity: snapshot.campaign.declaredIdentity,
	    permits: snapshot.campaign.permits,
	    unlockedSystems: snapshot.campaign.unlockedSystems,
	    completed: snapshot.campaign.completedContracts.map((contract) => contract.id),
	    active: snapshot.campaign.activeContracts.map((contract) => ({
	      id: contract.id,
	      title: contract.title,
	      kind: contract.kind,
	      source: contract.source ?? null,
	      score: contract.score,
	      deadlineDay: contract.deadlineDay,
	    })),
	    funds: snapshot.economy.funds,
	    skylineStatus: snapshot.macro.skylineStatus,
	    floorCount: snapshot.operations.floorCount,
    text: document.body.textContent ?? '',
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
    const snapshot = await waitFor('skyline charter victory', async () => {
      const value = await readCampaignSnapshot(devtools);
      return value.victory === 'won' && value.text.includes('Sandbox') ? value : null;
    });
    const expectedContracts = [
      'act-1-viable-core',
      'act-2-stable-operations',
      'act-3-tower-identity',
      'act-4-public-landmark',
      'act-5-skyline-institution',
    ];
    for (const id of expectedContracts) {
      if (!snapshot.completed.includes(id)) {
        throw new Error(`Missing completed campaign contract: ${id}`);
      }
    }
    if (!snapshot.permits.includes('skyline-charter')) throw new Error('Missing skyline charter');
    if (snapshot.declaredIdentity !== 'mixed-use') {
      throw new Error(`Expected mixed-use identity declaration, got ${snapshot.declaredIdentity}`);
    }
    if (!snapshot.unlockedSystems.includes('sandbox-city-cycle')) {
      throw new Error('Missing sandbox city cycle unlock');
    }
    if (!snapshot.active.some((contract) => contract.source === 'sandbox')) {
      throw new Error('Victory did not create an active sandbox city-cycle mandate');
    }
    if (snapshot.funds < 750_000) throw new Error('Victory treasury target was not met');
    if (snapshot.skylineStatus < 70) throw new Error('Victory skyline target was not met');
    if (snapshot.floorCount < 18) throw new Error('Victory height target was not met');
    process.stdout.write(`${JSON.stringify({ url, snapshot }, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
