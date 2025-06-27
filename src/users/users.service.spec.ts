import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { Users } from './entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import { UserRole } from '../common/constants';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<Users>;

  const mockUser: Users = {
    id: 1,
    email: 'test@example.com',
    password: 'hashedPassword',
    roles: [UserRole.VIEWER],
    createdDocuments: [],
    updatedDocuments: [],
  };

  const mockUserWithoutPassword = {
    id: 1,
    email: 'test@example.com',
    roles: [UserRole.VIEWER],
    createdDocuments: [],
    updatedDocuments: [],
  };

  const mockRegisterDto: RegisterDto = {
    email: 'newuser@example.com',
    password: 'password123',
    roles: [UserRole.EDITOR],
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(Users),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<Users>>(getRepositoryToken(Users));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should return a user when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(1);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const mockUsers = [mockUser];
      mockRepository.find.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(mockRepository.find).toHaveBeenCalledWith({
        relations: ['createdDocuments', 'updatedDocuments']
      });
      expect(result).toEqual(mockUsers);
    });
  });

  describe('findUserWithDocuments', () => {
    it('should return user with documents', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findUserWithDocuments(1);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['createdDocuments', 'updatedDocuments']
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findUserWithDocuments(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const hashedPassword = 'hashedPassword123';
      const newUser = { ...mockUser, id: 2, email: mockRegisterDto.email, password: hashedPassword };

      mockRepository.findOne.mockResolvedValue(null); // No existing user
      mockBcrypt.hash.mockResolvedValue(hashedPassword as never);
      mockRepository.create.mockReturnValue(newUser);
      mockRepository.save.mockResolvedValue(newUser);

      const result = await service.create(mockRegisterDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { email: mockRegisterDto.email } });
      expect(mockBcrypt.hash).toHaveBeenCalledWith(mockRegisterDto.password, 10);
      expect(mockRepository.create).toHaveBeenCalledWith({
        email: mockRegisterDto.email,
        password: hashedPassword,
        roles: mockRegisterDto.roles,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(newUser);
      expect(result).toEqual(newUser);
    });

    it('should throw ConflictException if user already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(mockRegisterDto)).rejects.toThrow(ConflictException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { email: mockRegisterDto.email } });
    });
  });

  describe('updateUserRole', () => {
    it('should update user roles by merging with existing roles and return without password', async () => {
      const updatedUser = { ...mockUser, roles: [UserRole.VIEWER, UserRole.EDITOR] };
      const updatedUserWithoutPassword = {
        id: updatedUser.id,
        email: updatedUser.email,
        roles: updatedUser.roles,
        createdDocuments: updatedUser.createdDocuments,
        updatedDocuments: updatedUser.updatedDocuments,
      };
      
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateUserRole(1, [UserRole.EDITOR]);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockRepository.save).toHaveBeenCalledWith(updatedUser);
      expect(result).toEqual(updatedUserWithoutPassword);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateUserRole(999, [UserRole.EDITOR])).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for invalid role', async () => {
      const invalidRoles = ['invalid_role' as UserRole];
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.updateUserRole(1, invalidRoles)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateUserRoles', () => {
    it('should update user roles', async () => {
      const updatedUser = { ...mockUser, roles: [UserRole.ADMIN] };
      
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateUserRoles(1, [UserRole.ADMIN]);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockRepository.save).toHaveBeenCalledWith(updatedUser);
      expect(result).toEqual(updatedUser);
    });

    it('should throw Error if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateUserRoles(999, [UserRole.ADMIN])).rejects.toThrow('User not found');
    });
  });
}); 