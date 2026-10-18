import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { AppModuleKey } from '../../common/constants/modules';
import { PermissionAction } from '../../common/constants/permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // List active users in the authenticated user's company.
  @RequirePermission(AppModuleKey.USER, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.usersService.findAll(user);
  }

  // Get one active user in the authenticated user's company.
  @RequirePermission(AppModuleKey.USER, PermissionAction.READ)
  @Get(':userId')
  findOne(@CurrentUser() user: UserContext, @Param('userId') userId: string) {
    return this.usersService.findOne(user, userId);
  }

  // Create a user with a hashed password in the authenticated user's company.
  @RequirePermission(AppModuleKey.USER, PermissionAction.CREATE)
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.usersService.create(user, createUserDto);
  }

  // Update user profile, organization, role, access scope, or password.
  @RequirePermission(AppModuleKey.USER, PermissionAction.UPDATE)
  @Patch(':userId')
  update(
    @CurrentUser() user: UserContext,
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(user, userId, updateUserDto);
  }

  // Soft-delete a user in the authenticated user's company.
  @RequirePermission(AppModuleKey.USER, PermissionAction.DELETE)
  @Delete(':userId')
  remove(@CurrentUser() user: UserContext, @Param('userId') userId: string) {
    return this.usersService.remove(user, userId);
  }
}
