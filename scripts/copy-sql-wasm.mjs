import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dest = join(process.cwd(), 'public', 'assets', 'sql-wasm.wasm');
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'), dest);
