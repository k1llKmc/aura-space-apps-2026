const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma'], { stdio: 'inherit' });
const prisma = new PrismaClient();
(async () => {
  if (await prisma.mission.count() === 0) {
    execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'apps/api/prisma/seed.ts'], { stdio: 'inherit' });
    execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'apps/api/prisma/smoke.ts'], { stdio: 'inherit' });
  }
  const username = process.env.AUTH_BOOTSTRAP_USERNAME || 'commander';
  if (!/^[a-z0-9_.-]{3,64}$/.test(username)) throw new Error('Invalid AUTH_BOOTSTRAP_USERNAME.');
  // Provision once. Restarts never reset credentials or create more administrators.
  if (await prisma.user.count() === 0) {
    const password = process.env.AUTH_BOOTSTRAP_PASSWORD;
    if (!password || password.length < 12 || password.length > 128) throw new Error('AUTH_BOOTSTRAP_PASSWORD must contain 12–128 characters.');
    const mission = await prisma.mission.findFirst({ where: { isCurrent: true } });
    if (!mission) throw new Error('A current mission is required for account bootstrap.');
    const salt = randomBytes(16).toString('hex');
    const hash = await promisify(scrypt)(password, salt, 64);
    await prisma.user.create({ data: { username, passwordHash: `scrypt:${salt}:${hash.toString('hex')}`, role: 'COMMANDER', missionId: mission.id } });
    console.log('Initial Commander account created. Credentials are stored in root .env.');
  }
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
