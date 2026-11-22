import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

// 본인 계정 관리는 관리자용 사용자 관리 권한과 독립적으로 제공한다.
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class UserProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  profile(@CurrentUser() user: UserContext) {
    return this.usersService.profile(user);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: UserContext,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user, dto);
  }

  @Patch('password')
  changePassword(
    @CurrentUser() user: UserContext,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user, dto);
  }
}
