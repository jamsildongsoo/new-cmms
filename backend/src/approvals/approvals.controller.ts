import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { UserContext } from '../auth/types/user-context.type';
import { AppModuleKey } from '../common/constants/modules';
import { PermissionAction } from '../common/constants/permissions';
import { ApprovalActionDto } from './dto/approval-action.dto';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { UpdateApprovalDto } from './dto/update-approval.dto';
import { ApprovalsService } from './approvals.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  // List approvals for one UI box: submit, pending, processed, closed, or reference.
  @RequirePermission(AppModuleKey.APPROVAL, PermissionAction.READ)
  @Get('boxes/:box')
  findBox(
    @CurrentUser() user: UserContext,
    @Param('box')
    box: 'submit' | 'pending' | 'processed' | 'closed' | 'reference',
  ) {
    return this.approvalsService.findBox(user, box);
  }

  // Search users by id or name for the approver picker.
  @RequirePermission(AppModuleKey.APPROVAL, PermissionAction.READ)
  @Get('users')
  searchUsers(@CurrentUser() user: UserContext, @Query('q') q?: string) {
    return this.approvalsService.searchUsers(user, q ?? '');
  }

  // Look up a user's name, department, title and position for the approver picker.
  @RequirePermission(AppModuleKey.APPROVAL, PermissionAction.READ)
  @Get('users/:userId')
  findUser(@CurrentUser() user: UserContext, @Param('userId') userId: string) {
    return this.approvalsService.findUserInfo(user, userId);
  }

  // Get one visible approval with its submitter, approver, and reference steps.
  @RequirePermission(AppModuleKey.APPROVAL, PermissionAction.READ)
  @Get(':approvalId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvalsService.findOne(user, approvalId);
  }

  // Create an approval draft, or create and submit immediately when submit is true.
  @RequirePermission(AppModuleKey.APPROVAL, PermissionAction.CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateApprovalDto) {
    return this.approvalsService.create(user, dto);
  }

  // Update a draft approval only; submitted or closed approvals are immutable.
  @RequirePermission(AppModuleKey.APPROVAL, PermissionAction.UPDATE)
  @Patch(':approvalId')
  update(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
    @Body() dto: UpdateApprovalDto,
  ) {
    return this.approvalsService.update(user, approvalId, dto);
  }

  // Soft-delete a draft approval only.
  @RequirePermission(AppModuleKey.APPROVAL, PermissionAction.DELETE)
  @Delete(':approvalId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvalsService.remove(user, approvalId);
  }

  // Move a draft approval into progress and activate the first approver.
  @RequirePermission(AppModuleKey.APPROVAL, PermissionAction.UPDATE)
  @Post(':approvalId/submit')
  submit(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvalsService.submit(user, approvalId);
  }

  // Approve the current pending approver step and advance to the next approver.
  @RequirePermission(AppModuleKey.APPROVAL, PermissionAction.UPDATE)
  @Post(':approvalId/approve')
  approve(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.approvalsService.approve(user, approvalId, dto);
  }

  // Reject the current pending approver step and close the approval as rejected.
  @RequirePermission(AppModuleKey.APPROVAL, PermissionAction.UPDATE)
  @Post(':approvalId/reject')
  reject(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.approvalsService.reject(user, approvalId, dto);
  }

  // Cancel an in-progress approval by the submitter.
  @RequirePermission(AppModuleKey.APPROVAL, PermissionAction.UPDATE)
  @Post(':approvalId/cancel')
  cancel(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvalsService.cancel(user, approvalId);
  }
}
