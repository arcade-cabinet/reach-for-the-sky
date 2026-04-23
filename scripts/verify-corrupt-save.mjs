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

async function main() {
  await withDevPage('/reach-for-the-sky/?scenario=opening', async ({ url, devtools }) => {
    await waitFor('opening scenario UI', async () => {
      const ready = await devtools.evaluate(
        `document.body.textContent?.includes('Settings') ?? false`,
      );
      return ready ? true : null;
    });

    const repositoryState = await devtools.evaluate(`
(async () => {
  const database = await import('/reach-for-the-sky/src/persistence/database.ts');
  const repository = await import('/reach-for-the-sky/src/persistence/saveRepository.ts');
  const db = await database.getDatabase();
  await db.run('INSERT OR REPLACE INTO saves (slot_id, data, saved_at) VALUES (?, ?, ?)', [
    'campaign-b',
    JSON.stringify({ version: 99, savedAt: '2026-04-22T00:00:00.000Z' }),
    '2026-04-22T00:00:00.000Z',
  ]);
  await database.saveWebStore();
  const slots = await repository.listSaveSlots();
  const corruptSaves = await repository.listCorruptSaves();
  const loaded = await repository.loadSnapshot('campaign-b');
  return {
    hasCampaignBSlot: slots.some((slot) => slot.slotId === 'campaign-b'),
    corruptSaves,
    loaded,
  };
})()
`);

    if (repositoryState.hasCampaignBSlot) throw new Error('Corrupt save was still listed');
    if (repositoryState.loaded !== null) throw new Error('Corrupt save unexpectedly loaded');
    if (!repositoryState.corruptSaves.some((save) => save.slotId === 'campaign-b')) {
      throw new Error('Corrupt save was not quarantined');
    }

    await clickButton(devtools, 'Settings');
    const ui = await waitFor(
      'corrupt save recovery visible in settings',
      async () =>
        devtools.evaluate(`
(() => {
  const panel = document.querySelector('.diagnostics-panel');
  const text = panel?.textContent ?? '';
  return text.includes('Corrupt save recovery') &&
    text.includes('Campaign B') &&
    text.includes('Unsupported save version: 99')
    ? { text }
    : null;
})()
`),
      20_000,
    );

    await clickButton(devtools, 'Forget');
    const cleared = await waitFor(
      'corrupt save recovery cleared',
      async () =>
        devtools.evaluate(`
(async () => {
  const repository = await import('/reach-for-the-sky/src/persistence/saveRepository.ts');
  const corruptSaves = await repository.listCorruptSaves();
  const panelText = document.querySelector('.diagnostics-panel')?.textContent ?? '';
  return corruptSaves.length === 0 && !panelText.includes('Corrupt save recovery')
    ? { corruptSaves: corruptSaves.length }
    : null;
})()
`),
      20_000,
    );

    process.stdout.write(`${JSON.stringify({ url, repositoryState, ui, cleared }, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
