import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../modules/auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TaskQueue } from '../modules/tasks/task-queue.service';
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly queue: TaskQueue) {}
  @Public()
  @Get()
  async readiness() {
    try { await this.prisma.$queryRaw`SELECT 1`; await this.queue.ping(); return { status: 'ok' }; }
    catch { throw new ServiceUnavailableException('A required dependency is unavailable.'); }
  }
}
