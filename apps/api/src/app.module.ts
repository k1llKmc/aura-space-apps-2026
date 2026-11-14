import { Module } from '@nestjs/common';
import { MissionModule } from './modules/mission/mission.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({ imports: [PrismaModule, MissionModule] })
export class AppModule {}
