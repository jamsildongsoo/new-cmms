import { PermissionAction } from '../../common/constants/permissions';
import { ModuleCode } from '../../common/constants/modules';
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { MonthlyClosingService } from './monthly-closing.service';
/** 월별 거래 잠금 API. Open·Close·해제는 각각 명시적 요청이며 잔고·월 집계 테이블을 생성하지 않는다. */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('monthly-closing')
export class MonthlyClosingController {
  constructor(private readonly service: MonthlyClosingService) {}
  @Get() @RequirePermission(ModuleCode.MCLOSE, PermissionAction.READ) list(
    @CurrentUser() user: UserContext,
  ) {
    return this.service.periods(user);
  }
  @Get(':month')
  @RequirePermission(ModuleCode.MCLOSE, PermissionAction.READ)
  month(@CurrentUser() user: UserContext, @Param('month') month: string) {
    return this.service.monthly(user, month);
  }
  @Post(':month/open')
  @RequirePermission(ModuleCode.MCLOSE, PermissionAction.UPDATE)
  open(@CurrentUser() user: UserContext, @Param('month') month: string) {
    return this.service.periodAction(user, month, 'open');
  }
  @Post(':month/unlock')
  @RequirePermission(ModuleCode.MCLOSE, PermissionAction.UPDATE)
  unlock(@CurrentUser() user: UserContext, @Param('month') month: string) {
    return this.service.periodAction(user, month, 'unlock');
  }
  @Post(':month/close')
  @RequirePermission(ModuleCode.MCLOSE, PermissionAction.UPDATE)
  close(@CurrentUser() user: UserContext, @Param('month') month: string) {
    return this.service.periodAction(user, month, 'close');
  }
}
