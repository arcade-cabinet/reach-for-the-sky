const globalWithVitest = globalThis as typeof globalThis & {
  __vitest_browser__?: boolean;
};

const viteEnv = (
  import.meta as ImportMeta & {
    env?: { MODE?: string; VITEST?: boolean | string };
  }
).env;

export const isVitestBrowser =
  globalWithVitest.__vitest_browser__ === true ||
  viteEnv?.MODE === "test" ||
  viteEnv?.VITEST === true ||
  viteEnv?.VITEST === "true";

export const browserTestCanvasGlOptions = isVitestBrowser
  ? { preserveDrawingBuffer: true }
  : undefined;
