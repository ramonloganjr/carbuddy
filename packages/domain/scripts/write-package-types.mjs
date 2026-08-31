import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Node decides whether a `.js` file is ESM or CommonJS from the nearest
 * `package.json` "type" field. Since the root package is `"type": "module"`,
 * the CommonJS output would be loaded as ESM and fail on its `require` calls.
 * Dropping a two-line `package.json` into each output directory pins the
 * interpretation per-directory, which is the standard dual-build fix.
 */
const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');

for (const [dir, type] of [['cjs', 'commonjs'], ['esm', 'module']]) {
  const target = resolve(dist, dir);
  mkdirSync(target, { recursive: true });
  writeFileSync(resolve(target, 'package.json'), `${JSON.stringify({ type }, null, 2)}\n`);
}

console.log('Wrote dist/cjs/package.json and dist/esm/package.json');
