import { Global, Module } from '@nestjs/common';
import { TaskQueue } from './task-queue.service';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
@Global()
@Module({ controllers: [TasksController], providers: [TaskQueue, TasksService], exports: [TaskQueue, TasksService] })
export class TasksModule {}
