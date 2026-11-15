import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CrewModule } from './modules/crew/crew.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TaskProcessor } from './modules/tasks/task-processor.service';
import { BackgroundWorker } from './modules/tasks/worker.service';
@Module({ imports: [PrismaModule, AuthModule, TasksModule, CrewModule], providers: [TaskProcessor, BackgroundWorker] })
export class WorkerModule {}
