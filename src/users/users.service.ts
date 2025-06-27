import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from './entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import { UserRole } from '../common/constants';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private usersRepository: Repository<Users>
  ) {}

  async findByEmail(email: string): Promise<Users> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<Users> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findAll(): Promise<Users[]> {
    return this.usersRepository.find({
      relations: [
        'createdDocuments',
        'updatedDocuments'
      ]
    });
  }

  async findUserWithDocuments(id: number): Promise<Users> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: [
        'createdDocuments',
        'updatedDocuments'
      ]
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(registerDto: RegisterDto): Promise<Users> {
    const existingUser = await this.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    const user = this.usersRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      roles: registerDto.roles,
    });

    return this.usersRepository.save(user);
  }

  async updateUserRoles(userId: number, newRoles: UserRole[]) {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.roles = newRoles;
    return this.usersRepository.save(user);
  }

  async updateUserRole(userId: number, newRoles: UserRole[]) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate roles
    for (const role of newRoles) {
      if (!Object.values(UserRole).includes(role)) {
        throw new ForbiddenException(`Invalid role: ${role}`);
      }
    }

    // Merge existing roles with new roles (avoid duplicates)
    const existingRoles = user.roles || [];
    const mergedRoles = [...new Set([...existingRoles, ...newRoles])] as UserRole[];

    const updatedUser = await this.updateUserRoles(userId, mergedRoles);
    const { password, ...result } = updatedUser;
    return result;
  }
}