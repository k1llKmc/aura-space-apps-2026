import { Controller, Get } from '@nestjs/common';
import { Public } from '../modules/auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Public()
  @Get()
  async readiness() { await this.prisma.$queryRaw`SELECT 1`; return { status: 'ok' }; }
}
