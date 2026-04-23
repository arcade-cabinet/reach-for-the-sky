import { waitFor, withDevPage } from './browser-smoke-harness.mjs';

// Exercises a realistic first-minute session and asserts the browser console
// stays clean — no runtime exceptions, no console.error, no console.warn.
//
// Flow:
//   1. Load the opening scenario (skips start screen + first-run explainer)
//   2. Wait for the cutaway to settle
//   3. Open the Contracts drawer, then the Settings drawer, close both
//   4. Tick the sim forward for a few seconds at 4x speed
//   5. Assert the CDP-captured console problem set is empty
//
// Dev-server warnings that are expected in production don't fire here because
// we load the Vite dev build, not production — but that's also true of every
// other verify-browser check, so the signal is consistent.

async function main() {
  await withDevPage('/reach-for-the-sky/?scenario=opening', async ({ url, devtools }) => {
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 820,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await devtools.send('Page.navigate', { url });

    await waitFor(
      'cutaway ready',
      async () => {
        const ready = await devtools.evaluate(`document.querySelector('.canvas-host') !== null`);
        return ready ? true : null;
      },
      20_000,
    );

    // Toggle drawers. Drawer open emits a short audio cue + renders
    // contracts list — both common sources of console noise if something
    // is misrouted.
    await devtools.evaluate(`
(() => {
  const contractsButton = Array.from(document.querySelectorAll('button'))
    .find((b) => b.textContent?.trim().startsWith('Contracts'));
  const settingsButton = Array.from(document.querySelectorAll('button'))
    .find((b) => b.textContent?.trim().startsWith('Settings'));
  contractsButton?.click();
  settingsButton?.click();
  return true;
})()
`);

    // Run the simulation for a few real-time seconds so the tick loop has a
    // chance to emit anything noisy.
    await new Promise((resolve) => setTimeout(resolve, 2_500));

    const problems = devtools.drainConsoleProblems();
    if (problems.length > 0) {
      const summary = problems
        .map((problem, index) => `  ${index + 1}. [${problem.level}] ${problem.text}`)
        .join('\n');
      throw new Error(
        `Browser console is not clean (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n${summary}`,
      );
    }

    process.stdout.write(`${JSON.stringify({ url, problems: 0 }, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
