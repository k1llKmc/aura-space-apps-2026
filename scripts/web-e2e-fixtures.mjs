import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
const cleanup = process.argv[2] === 'cleanup';
const file = '.test-data/web-fixture.json';
if (!cleanup && existsSync(file))
  throw new Error(
    'UI fixture already exists. Run cleanup before creating another fixture.',
  );
if (cleanup && !existsSync(file)) {
  console.log('No UI fixture to remove.');
  process.exit(0);
}
const command = process.env.E2E_NATIVE === '1' ? process.execPath : 'docker';
const args =
  process.env.E2E_NATIVE === '1'
    ? ['scripts/run.mjs', cleanup ? 'e2e-cleanup' : 'e2e-setup']
    : [
        'compose',
        'exec',
        '-T',
        '-e',
        'AURA_E2E_SETUP=1',
        'api',
        'node',
        'scripts/run.mjs',
        cleanup ? 'e2e-cleanup' : 'e2e-setup',
      ];
const output = execFileSync(command, args, {
  env: { ...process.env, AURA_E2E_SETUP: '1' },
  input: cleanup ? readFileSync(file) : undefined,
  stdio: ['pipe', 'pipe', 'pipe'],
});
if (!cleanup) {
  const fixture = JSON.parse(output.toString());
  mkdirSync('.test-data', { recursive: true });
  writeFileSync(file, JSON.stringify(fixture));
} else rmSync(file);
console.log(
  cleanup ? 'Synthetic UI fixture removed.' : 'Synthetic UI fixture prepared.',
);
