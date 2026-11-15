import { Module } from '@nestjs/common';
import { MissionModule } from './modules/mission/mission.module';
import { PrismaModule } from './prisma/prisma.module';
import { CrewModule } from './modules/crew/crew.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogController } from './modules/catalog/catalog.controller';
import { HealthController } from './common/health.controller';

@Module({ imports: [PrismaModule, AuthModule, MissionModule, CrewModule], controllers: [CatalogController, HealthController] })
export class AppModule {}
