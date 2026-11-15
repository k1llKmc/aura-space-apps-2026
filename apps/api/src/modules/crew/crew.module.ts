import { Module } from '@nestjs/common';
import { CrewController } from './crew.controller';
import { CrewService } from './crew.service';
import { HealthMonitor } from './health-monitor.service';
import { HealthRecordsController } from './health-records.controller';

@Module({ controllers: [CrewController, HealthRecordsController], providers: [CrewService, HealthMonitor] })
export class CrewModule {}
