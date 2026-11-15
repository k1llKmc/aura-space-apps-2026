import { Module } from '@nestjs/common';
import { MissionModule } from './modules/mission/mission.module';
import { PrismaModule } from './prisma/prisma.module';
import { CrewModule } from './modules/crew/crew.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogController } from './modules/catalog/catalog.controller';
import { HealthController } from './common/health.controller';
import { AuditController } from './common/audit.controller';
import { TasksModule } from './modules/tasks/tasks.module';

@Module({ imports: [PrismaModule, AuthModule, TasksModule, MissionModule, CrewModule], controllers: [CatalogController, HealthController, AuditController] })
export class AppModule {}
