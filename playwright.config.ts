import { defineConfig, devices } from '@playwright/test';

const IS_CI = !!process.env.CI;
// CI defaults to headless; PW_HEADLESS=1 forces it in local too. PW_HEADLESS=0
// explicitly opts out so local headed runs still work even under CI-like envs.
const IS_HEADLESS =
  process.env.PW_HEADLESS === '0'
    ? false
    : IS_CI || process.env.PW_HEADLESS === '1';
const CHROMIUM_CHANNEL =
  process.env.PW_CHROMIUM_CHANNEL ?? (!IS_CI && !IS_HEADLESS ? 'chrome' : undefined);
const DEFAULT_PORT = 41741;
const configuredPort = Number(process.env.PLAYWRIGHT_PORT ?? process.env.PW_PORT);
const PORT =
  Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : DEFAULT_PORT;
const BASE_URL = `http://127.0.0.1:${PORT}/reach-for-the-sky/`;
const REUSE_SERVER = !IS_CI && process.env.PW_REUSE_SERVER === '1';

// Pixi + WebGL needs GPU-capable flags. `--mute-audio` keeps the session
// quiet during dev runs; Tone.js only boots on user-interaction anyway.
const GAME_ARGS = [
  '--no-sandbox',
  '--use-angle=gl',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--mute-audio',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];

export default defineConfig({
  testDir: './e2e',
  // Tests share the same Capacitor Preferences + SQL wasm db inside the
  // dev server; multiple parallel workers stomp each other's state and
  // hang mid-bootstrap. Serialize for reliability.
  fullyParallel: false,
  workers: 1,
  retries: IS_CI ? 2 : 0,
  timeout: IS_CI ? 90_000 : 60_000,

  use: {
    baseURL: BASE_URL,
    headless: IS_HEADLESS,
    // page-level auto-screenshots hang on `document.fonts.ready` when
    // Pixi's bitmap fonts are registered. We capture via element-scoped
    // `locator('body').screenshot()` from helpers/shot.ts at the
    // meaningful moments instead. Still retain on failure for debugging.
    screenshot: { mode: 'only-on-failure', fullPage: false },
    video: IS_CI ? 'retain-on-failure' : 'off',
    trace: 'on-first-retry',
    actionTimeout: IS_CI ? 30_000 : 15_000,
    navigationTimeout: IS_CI ? 30_000 : 15_000,
    browserName: 'chromium',
    channel: CHROMIUM_CHANNEL,
    launchOptions: { args: GAME_ARGS },
  },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'e2e-artifacts',

  webServer: {
    // --strictPort: fail if PORT is in use rather than silently binding to a
    // different port that BASE_URL and webServer.url wouldn't match.
    command: `pnpm exec vite --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: REUSE_SERVER,
    timeout: 120_000,
  },

  // Mobile projects are opt-in via PW_ALL_PROJECTS=1 because each one
  // boots a full WebGL Pixi context + SQLite WASM + tick interval. Running
  // all three locally triples Chrome's resident memory even serialized —
  // the GPU pools and JS heaps are not released between projects promptly.
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    ...(process.env.PW_ALL_PROJECTS === '1'
      ? [
          { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
          { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
        ]
      : []),
  ],
});
