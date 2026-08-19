import { Injectable } from '@nestjs/common';

export interface TaskModel {
  // Chưa có MongoDB nên id là số tự tăng trong RAM,
  // giống cách RecipeModel của bạn từng dùng trước khi chuyển sang ObjectId dạng chuỗi.
  id: number;
  title: string;
  done: boolean;
}

@Injectable()
export class TasksService {
  private tasks: TaskModel[] = [];
  private nextId = 1;

  findAll(): TaskModel[] {
    return this.tasks;
  }

  findOne(id: number): TaskModel | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  create(title: string): TaskModel {
    const newTask: TaskModel = {
      id: this.nextId++,
      title,
      done: false,
    };
    this.tasks.push(newTask);
    return newTask;
  }

  markDone(id: number): TaskModel | undefined {
    const task = this.findOne(id);
    if (task) {
      task.done = true;
    }
    return task;
  }
}