import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { MonthlyClosingService } from './monthly-closing.service';
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('monthly-closing')
export class MonthlyClosingController {
  constructor(private readonly service: MonthlyClosingService) {}
  @Get() @RequirePermission('monthly_closing', 'read') list(
    @CurrentUser() user: UserContext,
  ) {
    return this.service.periods(user);
  }
  @Get(':month') @RequirePermission('monthly_closing', 'read') month(
    @CurrentUser() user: UserContext,
    @Param('month') month: string,
  ) {
    return this.service.monthly(user, month);
  }
  @Post(':month/open') @RequirePermission('monthly_closing', 'update') open(
    @CurrentUser() user: UserContext,
    @Param('month') month: string,
  ) {
    return this.service.periodAction(user, month, 'open');
  }
  @Post(':month/unlock') @RequirePermission('monthly_closing', 'update') unlock(
    @CurrentUser() user: UserContext,
    @Param('month') month: string,
  ) {
    return this.service.periodAction(user, month, 'unlock');
  }
  @Post(':month/close') @RequirePermission('monthly_closing', 'update') close(
    @CurrentUser() user: UserContext,
    @Param('month') month: string,
  ) {
    return this.service.periodAction(user, month, 'close');
  }
}
