import { waitFor, withDevPage } from './browser-smoke-harness.mjs';

const buttonExpression = (label) => `
(() => {
  const button = Array.from(document.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === ${JSON.stringify(label)},
  );
  if (!button) return false;
  button.click();
  return true;
})()
`;

const bodyIncludesExpression = (...needles) => `
(() => {
  const text = document.body.textContent ?? '';
  return ${JSON.stringify(needles)}.every((needle) => text.includes(needle));
})()
`;

async function clickButton(devtools, label) {
  const clicked = await devtools.evaluate(buttonExpression(label));
  if (!clicked) throw new Error(`Could not find ${label} button`);
}

async function clickSaveSlot(devtools, slotId) {
  const clicked = await devtools.evaluate(`
(() => {
  const button = document.querySelector(${JSON.stringify(`button[data-save-slot="${slotId}"]`)});
  if (!button) return false;
  button.click();
  return true;
})()
`);
  if (!clicked) throw new Error(`Could not find save slot ${slotId}`);
}

async function main() {
  await withDevPage('/reach-for-the-sky/?scenario=opening', async ({ url, devtools }) => {
    await waitFor('opening scenario UI', async () => {
      const ready = await devtools.evaluate(bodyIncludesExpression('City brief', 'Campaign A'));
      return ready ? true : null;
    });

    await clickSaveSlot(devtools, 'campaign-a');
    await clickButton(devtools, 'Save');
    const savedSnapshot = await waitFor('SQLite save row', async () => {
      const value = await devtools.evaluate(`
(async () => {
  const repository = await import('/reach-for-the-sky/src/persistence/saveRepository.ts');
  const snapshot = await repository.loadSnapshot('campaign-a');
  const slots = await repository.listSaveSlots();
  const summary = slots.find((slot) => slot.slotId === 'campaign-a');
  if (!snapshot || snapshot.tower.rooms.length < 50) return null;
  return {
    rooms: snapshot.tower.rooms.length,
    funds: snapshot.economy.funds,
    slotCount: slots.length,
    summary,
  };
})()
`);
      return value;
    });

    await clickButton(devtools, 'Reset');
    await waitFor('reset menu', async () => {
      const ready = await devtools.evaluate(bodyIncludesExpression('Break Ground'));
      return ready ? true : null;
    });

    await clickButton(devtools, 'Load');
    const restored = await waitFor('saved snapshot restored through UI load', async () => {
      const ready = await devtools.evaluate(`
(() => {
  const text = document.body.textContent ?? '';
  return text.includes('City brief') && !text.includes('Break Ground');
})()
`);
      return ready ? true : null;
    });
    const stats = await devtools.evaluate('window.reachForTheSkyRenderer?.getStats?.() ?? null');

    process.stdout.write(
      `${JSON.stringify({ url, saveLoad: { savedSnapshot, restored }, stats }, null, 2)}\n`,
    );
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
