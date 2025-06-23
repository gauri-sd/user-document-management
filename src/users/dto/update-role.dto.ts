import { IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from 'src/common/constants';

export class UpdateRoleDto {
  @ApiProperty({
    description: 'User roles array',
    example: ['editor', 'viewer'],
    enum: UserRole,
    isArray: true
  })
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];
} 