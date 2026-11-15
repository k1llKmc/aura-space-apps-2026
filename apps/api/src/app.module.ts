import { Module } from '@nestjs/common';
import { MissionModule } from './modules/mission/mission.module';
import { PrismaModule } from './prisma/prisma.module';
import { CrewModule } from './modules/crew/crew.module';

@Module({ imports: [PrismaModule, MissionModule, CrewModule] })
export class AppModule {}
