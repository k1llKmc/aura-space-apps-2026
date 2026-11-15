import { existsSync, copyFileSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (!existsSync('.env')) copyFileSync('.env.example', '.env');
process.loadEnvFile('.env');
const env = process.env;
// Generate local secrets once. Never print them or commit the root .env.
for (const key of ['JWT_SECRET', 'AUTH_BOOTSTRAP_PASSWORD']) {
  if (!env[key]) {
    env[key] = randomBytes(32).toString('hex');
    appendFileSync('.env', `\n${key}=${env[key]}\n`);
  }
}
env.DATABASE_URL ||= `postgresql://${encodeURIComponent(env.POSTGRES_USER || 'aura')}:${encodeURIComponent(env.POSTGRES_PASSWORD || 'aura_local_password')}@${env.POSTGRES_HOST || '127.0.0.1'}:${env.POSTGRES_PORT || '5432'}/${encodeURIComponent(env.POSTGRES_DB || 'aura')}?schema=public`;
env.DIRECT_URL ||= env.DATABASE_URL;
env.REDIS_URL ||= `redis://${env.REDIS_HOST || '127.0.0.1'}:${env.REDIS_PORT || '6379'}`;
env.API_PROXY_TARGET ||= `http://127.0.0.1:${env.API_PORT || '3001'}`;
const children = [];
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => children.forEach((child) => child.kill(signal)));
function launch(command, args) {
  const child = spawn(command, args, { stdio: 'inherit', env });
  children.push(child);
  child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  return child;
}
function node(script, args = []) { return launch(process.execPath, [path.join(root, script), ...args]); }
const mode = process.argv[2];
if (mode === 'ci-test') {
  env.AURA_TEST_DATABASE_URL = env.DATABASE_URL;
  env.AURA_TEST_REDIS_URL = env.REDIS_URL;
  launch(process.execPath, ['--test', 'apps/api/test/crew.test.cjs', 'apps/api/test/crew.database.test.cjs', 'apps/api/test/auth.database.test.cjs', 'apps/api/test/health-rules.test.cjs', 'apps/api/test/health.database.test.cjs', 'apps/api/test/tasks.queue.test.cjs'])
    .on('exit', (code) => { process.exitCode = code ?? 1; });
} else if (['api', 'bootstrap', 'worker', 'worker-health', 'worker-smoke'].includes(mode)) {
  const entries = { api: 'apps/api/dist/main.js', bootstrap: 'scripts/bootstrap.cjs', worker: 'apps/api/dist/worker.js', 'worker-health': 'apps/api/dist/worker-health.js', 'worker-smoke': 'scripts/verify-worker.cjs' };
  node(entries[mode]).on('exit', (code) => { process.exitCode = code ?? 1; });
} else if (mode === 'up') {
  launch('docker', ['compose', 'up', '--build', '-d', '--wait']).on('exit', (code) => { process.exitCode = code ?? 1; });
} else if (mode === 'dev') {
  const shared = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'packages/shared-types/tsconfig.json'], { stdio: 'inherit', env });
  if (shared.status !== 0) process.exit(shared.status ?? 1);
  // Nest DI requires tsc decorator metadata, which tsx/esbuild does not emit.
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'apps/api/tsconfig.json'], { stdio: 'inherit', env });
  if (build.status !== 0) process.exit(build.status ?? 1);
  node('node_modules/typescript/bin/tsc', ['-p', 'apps/api/tsconfig.json', '--watch', '--preserveWatchOutput']);
  launch(process.execPath, ['--watch', '--watch-path', 'apps/api/dist', 'apps/api/dist/main.js']);
  launch(process.execPath, ['--watch', '--watch-path', 'apps/api/dist', 'apps/api/dist/worker.js']);
  node('node_modules/next/dist/bin/next', ['dev', 'apps/web', '-p', env.WEB_PORT || '3000']);
  children.forEach((child) => child.on('exit', (code) => {
    children.filter((other) => other !== child).forEach((other) => other.kill());
    process.exitCode = code ?? 1;
  }));
} else {
  const commands = {
    generate: ['node_modules/prisma/build/index.js', 'generate'],
    migrate: ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    seed: ['node_modules/tsx/dist/cli.mjs', 'apps/api/prisma/seed.ts'],
    smoke: ['node_modules/tsx/dist/cli.mjs', 'apps/api/prisma/smoke.ts'],
    'web-build': ['node_modules/next/dist/bin/next', 'build', 'apps/web'],
  };
  const args = commands[mode];
  if (mode === 'web-build') {
    const built = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'packages/shared-types/tsconfig.json'], { stdio: 'inherit', env });
    if (built.status !== 0) process.exit(built.status ?? 1);
  }
  if (!args) throw new Error(`Unknown command: ${mode}`);
  if (['generate', 'migrate'].includes(mode)) args.push('--schema', 'apps/api/prisma/schema.prisma');
  node(args[0], args.slice(1)).on('exit', (code) => { process.exitCode = code ?? 1; });
}
