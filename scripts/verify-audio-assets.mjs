import { waitFor, withDevPage } from './browser-smoke-harness.mjs';

async function main() {
  await withDevPage('/reach-for-the-sky/?scenario=opening', async ({ url, devtools }) => {
    const result = await waitFor('audio sprite fetch and decode', async () => {
      return devtools.evaluate(`
(async () => {
  const audio = await import('/reach-for-the-sky/src/audio/audioEngine.ts');
  const assetUrl = audio.resolveAudioAsset(audio.DEFAULT_AUDIO_SAMPLE_PATHS[0], '/reach-for-the-sky/');
  const response = await fetch(assetUrl, { cache: 'no-store' });
  if (!response.ok) return null;
  const bytes = await response.arrayBuffer();
  const context = new AudioContext();
  const decoded = await context.decodeAudioData(bytes.slice(0));
  await context.close();
  const sprite = audio.DEFAULT_AUDIO_SPRITE;
  const durationMs = Math.round(decoded.duration * 1000);
  const windowsFit = Object.entries(sprite).every(([, [offset, duration]]) => offset + duration <= durationMs + 40);
  return {
    assetUrl,
    byteLength: bytes.byteLength,
    durationMs,
    cues: Object.keys(sprite),
    windowsFit,
  };
})()
`);
    });

    if (!result.windowsFit) throw new Error('Audio sprite windows exceed decoded OGG duration');
    if (result.byteLength < 1024) throw new Error('Audio sprite asset is unexpectedly small');
    process.stdout.write(`${JSON.stringify({ url, audio: result }, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
