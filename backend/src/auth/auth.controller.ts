import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { UserContext } from './types/user-context.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Authenticate a user and issue an access token with user context.
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // Return the authenticated user's current server-side context.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: UserContext | undefined): UserContext | undefined {
    return user;
  }
}
