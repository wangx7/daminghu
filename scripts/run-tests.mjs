import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const rootDir = resolve(import.meta.dirname, '..');
const webRequire = createRequire(resolve(rootDir, 'packages/web-client/package.json'));
const viteEntry = webRequire.resolve('vite');
const viteRequire = createRequire(viteEntry);
const esbuild = viteRequire('esbuild');

const outDir = mkdtempSync(join(tmpdir(), 'daminghu-test-'));
const outFile = join(outDir, 'core.test.mjs');

try {
  await esbuild.build({
    entryPoints: [resolve(rootDir, 'tests/core.test.ts')],
    outfile: outFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    external: ['node:*'],
    alias: {
      '@daminghu/shared': resolve(rootDir, 'packages/shared/src/index.ts'),
    },
  });

  execFileSync(process.execPath, ['--test', outFile], { stdio: 'inherit' });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
