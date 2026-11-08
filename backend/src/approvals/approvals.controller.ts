import { AppModuleKey } from '../common/constants/modules';
import { NumberingService } from '../numbering/numbering.service';
import { Headers } from '@nestjs/common';
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UserContext } from '../auth/types/user-context.type';
import { ApprovalActionDto } from './dto/approval-action.dto';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { UpdateApprovalDto } from './dto/update-approval.dto';
import { ApprovalsService } from './approvals.service';

@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly approvalsService: ApprovalsService,
  ) {}

  // List approvals for one UI box: submit, pending, processed, closed, or reference.
  @Get('boxes/:box')
  findBox(
    @CurrentUser() user: UserContext,
    @Param('box')
    box: 'submit' | 'pending' | 'processed' | 'closed' | 'reference',
  ) {
    return this.approvalsService.findBox(user, box);
  }

  // Search users by id or name for the approver picker.
  @Get('users')
  searchUsers(@CurrentUser() user: UserContext, @Query('q') q?: string) {
    return this.approvalsService.searchUsers(user, q ?? '');
  }

  // Look up a user's name, department, title and position for the approver picker.
  @Get('users/:userId')
  findUser(@CurrentUser() user: UserContext, @Param('userId') userId: string) {
    return this.approvalsService.findUserInfo(user, userId);
  }

  // Get one visible approval with its submitter, approver, and reference steps.
  @Get(':approvalId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvalsService.findOne(user, approvalId);
  }

  // Create an approval draft, or create and submit immediately when submit is true.
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateApprovalDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.numbering.createDocument(
      user,
      AppModuleKey.APPROVAL,
      requestKey,
      (documentId) =>
        this.approvalsService.create(
          user,
          Object.assign({}, dto, { approvalId: documentId }),
        ),
      (documentId) => this.approvalsService.findOne(user, documentId),
      dto.attachmentId,
      Boolean(dto.refModule && dto.refId),
      (documentId) => this.approvalsService.resumeCreate(user, documentId, dto),
    );
  }

  // Update a draft approval only; submitted or closed approvals are immutable.
  @Patch(':approvalId')
  update(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
    @Body() dto: UpdateApprovalDto,
  ) {
    return this.numbering.saveDocument(
      user,
      AppModuleKey.APPROVAL,
      approvalId,
      dto.attachmentId,
      () => this.approvalsService.update(user, approvalId, dto),
      Boolean(dto.refModule && dto.refId),
    );
  }

  // Soft-delete a draft approval only.
  @Delete(':approvalId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvalsService.remove(user, approvalId);
  }

  // Move a draft approval into progress and activate the first approver.
  @Post(':approvalId/submit')
  submit(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvalsService.submit(user, approvalId);
  }

  // Approve the current pending approver step and advance to the next approver.
  @Post(':approvalId/approve')
  approve(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.approvalsService.approve(user, approvalId, dto);
  }

  // Reject the current pending approver step and close the approval as rejected.
  @Post(':approvalId/reject')
  reject(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.approvalsService.reject(user, approvalId, dto);
  }

  // Cancel an in-progress approval by the submitter.
  @Post(':approvalId/cancel')
  cancel(
    @CurrentUser() user: UserContext,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvalsService.cancel(user, approvalId);
  }
}
