import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

function copySqlWasmPlugin() {
  return {
    name: 'copy-sql-wasm',
    buildStart() {
      const dest = resolve(import.meta.dirname, 'public/assets/sql-wasm.wasm');
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'), dest);
    },
  };
}

function pixiChunk(id: string): string {
  if (id.includes('/pixi-viewport/')) return 'vendor-pixi-viewport';
  const libIndex = id.indexOf('/pixi.js/lib/');
  if (libIndex === -1) return 'vendor-pixi-core';

  const pixiPath = id.slice(libIndex + '/pixi.js/lib/'.length);
  if (pixiPath.startsWith('assets/') || pixiPath.startsWith('spritesheet/')) {
    return 'vendor-pixi-assets';
  }
  if (
    pixiPath.startsWith('scene/graphics/') ||
    pixiPath.startsWith('maths/') ||
    pixiPath.startsWith('color/')
  ) {
    return 'vendor-pixi-graphics';
  }
  if (pixiPath.startsWith('scene/text/')) return 'vendor-pixi-text';
  if (pixiPath.startsWith('scene/') || pixiPath.startsWith('culling/')) {
    return 'vendor-pixi-scene';
  }
  if (
    pixiPath.startsWith('rendering/') ||
    pixiPath.startsWith('environment') ||
    pixiPath.startsWith('extensions/') ||
    pixiPath.startsWith('ticker/') ||
    pixiPath.startsWith('app/') ||
    pixiPath.startsWith('_virtual/')
  ) {
    return 'vendor-pixi-core';
  }
  return 'vendor-pixi-misc';
}

function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('/solid-js/') || id.includes('/solid-pixi/')) return 'vendor-ui';
  if (id.includes('/pixi.js/') || id.includes('/@pixi/') || id.includes('/pixi-viewport/'))
    return pixiChunk(id);
  if (id.includes('/three/')) return 'vendor-three';
  if (id.includes('/tone/') || id.includes('/howler/')) return 'vendor-audio';
  if (id.includes('/@capacitor/') || id.includes('/jeep-sqlite/') || id.includes('/sql.js/')) {
    return 'vendor-storage';
  }
  if (id.includes('/koota/')) return 'vendor-koota';
  if (id.includes('/yuka/')) return 'vendor-ai';
  return 'vendor';
}

const base = process.env.CAPACITOR === 'true' ? './' : '/reach-for-the-sky/';

export default defineConfig({
  base,
  plugins: [solid(), copySqlWasmPlugin()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@app': resolve(import.meta.dirname, 'app'),
      '@logic': resolve(import.meta.dirname, 'src'),
      crypto: resolve(import.meta.dirname, 'src/compat-node-crypto.ts'),
      'node:crypto': resolve(import.meta.dirname, 'src/compat-node-crypto.ts'),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: { manualChunks },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
