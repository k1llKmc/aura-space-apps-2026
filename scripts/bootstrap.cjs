const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma'], { stdio: 'inherit' });
const prisma = new PrismaClient();
(async () => {
  if (await prisma.mission.count() === 0) {
    execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'apps/api/prisma/seed.ts'], { stdio: 'inherit' });
    execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'apps/api/prisma/smoke.ts'], { stdio: 'inherit' });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
