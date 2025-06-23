import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Headers,
  Put,
  Param,
  ParseIntPipe
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiBearerAuth, 
  ApiParam,
  ApiBody 
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  async logout(@Headers('authorization') authHeader: string) {
    const token = authHeader.replace('Bearer ', '');
    return this.authService.logout(token);
  }
}