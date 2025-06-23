import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import { UserRole } from '../common/constants';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    password: 'hashedPassword',
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
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found by email', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(1);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999 },
      });
    });
  });

  describe('findAll', () => {
    it('should return all users with documents', async () => {
      const users = [mockUser];
      mockRepository.find.mockResolvedValue(users);

      const result = await service.findAll();

      expect(mockRepository.find).toHaveBeenCalledWith({
        relations: ['createdDocuments', 'updatedDocuments'],
      });
      expect(result).toEqual(users);
    });
  });

  describe('findUserWithDocuments', () => {
    it('should return a user with documents by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findUserWithDocuments(1);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['createdDocuments', 'updatedDocuments'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findUserWithDocuments(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const newUser = { ...mockUser, id: 2, email: mockRegisterDto.email };
      
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(newUser);
      mockRepository.save.mockResolvedValue(newUser);

      const result = await service.create(mockRegisterDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockRegisterDto.email },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        email: mockRegisterDto.email,
        password: mockRegisterDto.password,
        roles: mockRegisterDto.roles,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(newUser);
      expect(result).toEqual(newUser);
    });

    it('should throw ConflictException if user with email already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(mockRegisterDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockRegisterDto.email },
      });
    });
  });

  describe('updateUserRoles', () => {
    it('should update user roles successfully', async () => {
      const newRoles = [UserRole.ADMIN, UserRole.EDITOR];
      const updatedUser = { ...mockUser, roles: newRoles };

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateUserRoles(1, newRoles);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockRepository.save).toHaveBeenCalledWith(updatedUser);
      expect(result).toEqual(updatedUser);
    });

    it('should throw Error if user not found', async () => {
      const newRoles = [UserRole.ADMIN];
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateUserRoles(999, newRoles)).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const newRoles = [UserRole.ADMIN];
      const updatedUser = { ...mockUser, roles: [UserRole.VIEWER, UserRole.ADMIN] };
      const { password, ...expectedResult } = updatedUser;

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateUserRole(1, newRoles);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockRepository.save).toHaveBeenCalledWith(updatedUser);
      expect(result).toEqual(expectedResult);
    });

    it('should throw NotFoundException if user not found', async () => {
      const newRoles = [UserRole.ADMIN];
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateUserRole(999, newRoles)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for invalid role', async () => {
      const invalidRoles = ['invalid_role' as UserRole];
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.updateUserRole(1, invalidRoles)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should merge roles without duplicates', async () => {
      const newRoles = [UserRole.ADMIN];
      const userWithExistingRoles = { ...mockUser, roles: [UserRole.VIEWER, UserRole.ADMIN] };
      const updatedUser = { ...userWithExistingRoles, roles: [UserRole.VIEWER, UserRole.ADMIN] };
      const { password, ...expectedResult } = updatedUser;

      mockRepository.findOne.mockResolvedValue(userWithExistingRoles);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateUserRole(1, newRoles);

      expect(result).toEqual(expectedResult);
      expect(result.roles).toHaveLength(2);
      expect(result.roles).toContain(UserRole.VIEWER);
      expect(result.roles).toContain(UserRole.ADMIN);
    });
  });
}); 