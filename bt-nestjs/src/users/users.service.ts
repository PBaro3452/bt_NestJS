import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private users: CreateUserDto[] = [];

  create(createUserDto: CreateUserDto) {
    this.users.push(createUserDto);
    return 'This action adds a new user';
  }

  findAll() {
    return this.users;
  }

  findOne(id: number) {
    return this.users[id];
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    this.users[id] = { ...this.users[id], ...updateUserDto };
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    this.users.splice(id, 1);
    return `This action removes a #${id} user`;
  }
}