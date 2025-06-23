import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/constants';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    password: 'password123',
    roles: [UserRole.VIEWER],
    createdDocuments: [],
    updatedDocuments: [],
  };

  const mockRegisterDto: RegisterDto = {
    email: 'newuser@example.com',
    password: 'password123',
    roles: [UserRole.EDITOR],
  };

  const mockLoginDto: LoginDto = {
    email: 'test@example.com',
    password: 'password123',
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const newUser = { ...mockUser, id: 2, email: mockRegisterDto.email };

      mockUsersService.create.mockResolvedValue(newUser);

      const result = await service.register(mockRegisterDto);

      expect(mockUsersService.create).toHaveBeenCalledWith(mockRegisterDto);
      expect(result).toEqual({
        id: newUser.id,
        email: newUser.email,
        roles: newUser.roles,
        createdDocuments: newUser.createdDocuments,
        updatedDocuments: newUser.updatedDocuments,
      });
    });
  });

  describe('validateUser', () => {
    it('should return user if credentials are correct', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser(mockLoginDto.email, mockLoginDto.password);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(mockLoginDto.email);
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        roles: mockUser.roles,
        createdDocuments: mockUser.createdDocuments,
        updatedDocuments: mockUser.updatedDocuments,
      });
    });

    it('should return null if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser(mockLoginDto.email, mockLoginDto.password);

      expect(result).toBeNull();
    });

    it('should return null if password is incorrect', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser(mockLoginDto.email, 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should login user successfully with correct credentials', async () => {
      const expectedToken = 'jwt_token_123';
      const userWithoutPassword = {
        id: mockUser.id,
        email: mockUser.email,
        roles: mockUser.roles,
        createdDocuments: mockUser.createdDocuments,
        updatedDocuments: mockUser.updatedDocuments,
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue(expectedToken);

      const result = await service.login(mockLoginDto);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        username: mockUser.email,
        sub: mockUser.id,
        roles: mockUser.roles,
      });
      expect(result).toEqual({
        access_token: expectedToken,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          roles: mockUser.roles,
        },
      });
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(mockLoginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should add token to blacklist', async () => {
      const token = 'test_token';

      const result = await service.logout(token);

      expect(service.isTokenBlacklisted(token)).toBe(true);
      expect(result).toEqual({ message: 'Successfully logged out' });
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      const token = 'blacklisted_token';
      await service.logout(token);

      const result = service.isTokenBlacklisted(token);

      expect(result).toBe(true);
    });

    it('should return false for non-blacklisted token', () => {
      const token = 'valid_token';

      const result = service.isTokenBlacklisted(token);

      expect(result).toBe(false);
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      const token = 'valid_token';
      const payload = { username: mockUser.email, sub: mockUser.id, roles: mockUser.roles };

      mockJwtService.verify.mockReturnValue(payload);
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await service.validateToken(token);

      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
      expect(mockUsersService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(payload);
    });

    it('should throw UnauthorizedException for blacklisted token', async () => {
      const token = 'blacklisted_token';
      await service.logout(token);

      await expect(service.validateToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const token = 'invalid_token';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.validateToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const token = 'valid_token';
      const payload = { username: mockUser.email, sub: mockUser.id, roles: mockUser.roles };

      mockJwtService.verify.mockReturnValue(payload);
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.validateToken(token)).rejects.toThrow(UnauthorizedException);
    });
  });
}); 