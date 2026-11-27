import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const rootDir = resolve(import.meta.dirname, '..');
const testsDir = resolve(rootDir, 'tests');
const testFiles = readdirSync(testsDir)
  .filter((name) => name.endsWith('.test.ts'))
  .sort()
  .map((name) => resolve(testsDir, name));

if (testFiles.length === 0) {
  console.error('No *.test.ts files found in tests/');
  process.exit(1);
}

const webRequire = createRequire(resolve(rootDir, 'packages/web-client/package.json'));
const viteEntry = webRequire.resolve('vite');
const viteRequire = createRequire(viteEntry);
const esbuild = viteRequire('esbuild');

const outDir = mkdtempSync(join(tmpdir(), 'daminghu-test-'));

try {
  const builtFiles = [];
  for (const entry of testFiles) {
    const outFile = join(outDir, basename(entry, '.ts') + '.mjs');
    await esbuild.build({
      entryPoints: [entry],
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
    builtFiles.push(outFile);
  }

  execFileSync(process.execPath, ['--test', ...builtFiles], { stdio: 'inherit' });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
