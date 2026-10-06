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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { UserContext } from '../auth/types/user-context.type';
import { AppModuleKey } from '../common/constants/modules';
import {
  buildPermissionCode,
  PermissionAction,
} from '../common/constants/permissions';
import { ApprovalActionDto } from './dto/approval-action.dto';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { UpdateApprovalDto } from './dto/update-approval.dto';
import { ApprovalsService } from './approvals.service';

const APPROVAL_READ = buildPermissionCode(
  AppModuleKey.APPROVAL,
  PermissionAction.READ,
);
const APPROVAL_CREATE = buildPermissionCode(
  AppModuleKey.APPROVAL,
  PermissionAction.CREATE,
);
const APPROVAL_UPDATE = buildPermissionCode(
  AppModuleKey.APPROVAL,
  PermissionAction.UPDATE,
);
const APPROVAL_DELETE = buildPermissionCode(
  AppModuleKey.APPROVAL,
  PermissionAction.DELETE,
);

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  // List approvals for one UI box: submit, pending, processed, closed, or reference.
  @RequirePermissions(APPROVAL_READ)
  @Get('boxes/:box')
  findBox(
    @CurrentUser() user: UserContext,
    @Param('box')
    box: 'submit' | 'pending' | 'processed' | 'closed' | 'reference',
  ) {
    return this.approvalsService.findBox(user, box);
  }

  // Get one visible approval with its submitter, approver, and reference steps.
  @RequirePermissions(APPROVAL_READ)
  @Get(':approvalId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvalsService.findOne(user, approvalId);
  }

  // Create an approval draft, or create and submit immediately when submit is true.
  @RequirePermissions(APPROVAL_CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateApprovalDto) {
    return this.approvalsService.create(user, dto);
  }

  // Update a draft approval only; submitted or closed approvals are immutable.
  @RequirePermissions(APPROVAL_UPDATE)
  @Patch(':approvalId')
  update(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
    @Body() dto: UpdateApprovalDto,
  ) {
    return this.approvalsService.update(user, approvalId, dto);
  }

  // Soft-delete a draft approval only.
  @RequirePermissions(APPROVAL_DELETE)
  @Delete(':approvalId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvalsService.remove(user, approvalId);
  }

  // Move a draft approval into progress and activate the first approver.
  @RequirePermissions(APPROVAL_UPDATE)
  @Post(':approvalId/submit')
  submit(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvalsService.submit(user, approvalId);
  }

  // Approve the current pending approver step and advance to the next approver.
  @RequirePermissions(APPROVAL_UPDATE)
  @Post(':approvalId/approve')
  approve(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.approvalsService.approve(user, approvalId, dto);
  }

  // Reject the current pending approver step and close the approval as rejected.
  @RequirePermissions(APPROVAL_UPDATE)
  @Post(':approvalId/reject')
  reject(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.approvalsService.reject(user, approvalId, dto);
  }

  // Cancel an in-progress approval by the submitter.
  @RequirePermissions(APPROVAL_UPDATE)
  @Post(':approvalId/cancel')
  cancel(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvalsService.cancel(user, approvalId);
  }
}
