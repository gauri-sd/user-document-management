import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import { UserRole } from '../common/constants';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  async findByEmail(email: string): Promise<User> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      relations: [
        'createdDocuments',
        'updatedDocuments'
      ]
    });
  }

  async findUserWithDocuments(id: number): Promise<User> {
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

  async create(registerDto: RegisterDto): Promise<User> {
    const existingUser = await this.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const user = this.usersRepository.create({
      email: registerDto.email,
      password: registerDto.password, // In production, this should be hashed
      roles: registerDto.roles,
    });

    return this.usersRepository.save(user);
  }

  async updateUserRoles(userId: number, newRoles: UserRole[]): Promise<User> {
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