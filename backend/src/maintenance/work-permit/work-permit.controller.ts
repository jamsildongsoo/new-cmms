import { NumberingService } from '../../numbering/numbering.service';
import { Headers } from '@nestjs/common';
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
import { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import { UpdateWorkPermitDto } from './dto/update-work-permit.dto';
import { WorkPermitService } from './work-permit.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('work-permit')
export class WorkPermitController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: WorkPermitService,
  ) {}

  @RequirePermission(AppModuleKey.WORK_PERMIT, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.service.findAll(user);
  }

  @RequirePermission(AppModuleKey.WORK_PERMIT, PermissionAction.READ)
  @Get('options')
  options(@CurrentUser() user: UserContext) {
    return this.service.options(user);
  }
  @RequirePermission(AppModuleKey.WORK_PERMIT, PermissionAction.READ)
  @Get(':workPermitId/approval-draft')
  draft(@CurrentUser() user: UserContext, @Param('workPermitId') id: string) {
    return this.service.approvalDraft(user, id);
  }
  @RequirePermission(AppModuleKey.WORK_PERMIT, PermissionAction.READ)
  @Get(':workPermitId/print-data')
  printData(
    @CurrentUser() user: UserContext,
    @Param('workPermitId') id: string,
  ) {
    return this.service.printData(user, id);
  }
  @RequirePermission(AppModuleKey.WORK_PERMIT, PermissionAction.READ)
  @Get(':workPermitId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('workPermitId') workPermitId: string,
  ) {
    return this.service.findOne(user, workPermitId);
  }

  @RequirePermission(AppModuleKey.WORK_PERMIT, PermissionAction.CREATE)
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateWorkPermitDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.numbering.createDocument(
      user,
      AppModuleKey.WORK_PERMIT,
      requestKey,
      (documentId) =>
        this.service.create(
          user,
          Object.assign({}, dto, { workPermitId: documentId }),
        ),
      (documentId) => this.service.findOne(user, documentId),
      dto.attachmentId,
    );
  }

  @RequirePermission(AppModuleKey.WORK_PERMIT, PermissionAction.UPDATE)
  @Patch(':workPermitId')
  update(
    @CurrentUser() user: UserContext,
    @Param('workPermitId') workPermitId: string,
    @Body() dto: UpdateWorkPermitDto,
  ) {
    return this.numbering.saveDocument(
      user,
      AppModuleKey.WORK_PERMIT,
      workPermitId,
      dto.attachmentId,
      () => this.service.update(user, workPermitId, dto),
    );
  }

  @RequirePermission(AppModuleKey.WORK_PERMIT, PermissionAction.DELETE)
  @Delete(':workPermitId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('workPermitId') workPermitId: string,
  ) {
    return this.service.remove(user, workPermitId);
  }
}
