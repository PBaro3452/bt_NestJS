import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { TasksService } from './task.service';   // bỏ chữ "s"
import type { TaskModel } from './task.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  getAll(): TaskModel[] {
    return this.tasksService.findAll();
  }

  @Post()
  create(@Body('title') title: string): TaskModel {
    return this.tasksService.create(title);
  }

  @Get(':id')
  getOne(@Param('id') id: string): TaskModel {
    const task = this.tasksService.findOne(Number(id));
    if (!task) {
      throw new NotFoundException();
    }
    return task;
  }

  @Patch(':id/done')
  markDone(@Param('id') id: string): TaskModel {
    const task = this.tasksService.markDone(Number(id));
    if (!task) {
      throw new NotFoundException();
    }
    return task;
  }
}