import { Body, Controller, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiParam,
  ApiBody
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UserRole } from '../common/constants';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  async findAll() {
    const users = await this.usersService.findAll();
    // Remove passwords from response
    return users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('/:id/roles')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user roles (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID', type: 'number' })
  @ApiBody({ type: UpdateRoleDto })
  async updateUserRoles(
    @Param('id', ParseIntPipe) userId: number,
    @Body() updateRoleDto: UpdateRoleDto
  ) {
    return this.usersService.updateUserRole(userId, updateRoleDto.roles);
  }
}