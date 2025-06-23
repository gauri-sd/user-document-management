import { IsEmail, IsString, MinLength, IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from 'src/common/constants';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com'
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password (minimum 6 characters)',
    example: 'password123',
    minLength: 6
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'User roles array',
    example: ['viewer', 'editor'],
    enum: UserRole,
    isArray: true
  })
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];
} 