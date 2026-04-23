import { waitFor, withDevPage } from './browser-smoke-harness.mjs';

async function main() {
  await withDevPage('/reach-for-the-sky/?scenario=opening', async ({ url, devtools }) => {
    const stats = await waitFor('render stats cache hit', async () => {
      const value = await devtools.evaluate('window.reachForTheSkyRenderer?.getStats?.() ?? null');
      if (
        value &&
        value.frames >= 3 &&
        value.normalBaseRebuilds >= 1 &&
        value.normalBaseHits >= 1 &&
        value.dynamicOverlayFrames === value.frames
      ) {
        return value;
      }
      return null;
    });

    process.stdout.write(`${JSON.stringify({ url, stats }, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
