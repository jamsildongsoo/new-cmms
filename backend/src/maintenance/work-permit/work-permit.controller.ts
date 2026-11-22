import { SearchPermitDto } from './dto/search-permit.dto';
import { NumberingService } from '../../numbering/numbering.service';
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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { ModuleCode } from '../../common/constants/modules';
import { PermissionAction } from '../../common/constants/permissions';
import { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import { UpdateWorkPermitDto } from './dto/update-work-permit.dto';
import { WorkPermitService } from './work-permit.service';

/** 작업허가 API. 원문 저장·결재 초안 구성·인쇄 데이터 조회를 구분한다. */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('work-permit')
export class WorkPermitController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: WorkPermitService,
  ) {}

  @RequirePermission(ModuleCode.PERMIT, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext, @Query() query: SearchPermitDto) {
    return this.service.findAll(user, query);
  }

  @RequirePermission(ModuleCode.PERMIT, PermissionAction.READ)
  @Get('options')
  options(@CurrentUser() user: UserContext) {
    return this.service.options(user);
  }
  @RequirePermission(ModuleCode.PERMIT, PermissionAction.READ)
  // 결재에 사용할 본문 데이터 구성이다. 이 조회 자체가 결재 문서를 저장하거나 상신하지는 않는다.
  @Get(':workPermitId/approval-draft')
  draft(@CurrentUser() user: UserContext, @Param('workPermitId') id: string) {
    return this.service.approvalDraft(user, id);
  }
  @RequirePermission(ModuleCode.PERMIT, PermissionAction.READ)
  @Get(':workPermitId/print-data')
  printData(
    @CurrentUser() user: UserContext,
    @Param('workPermitId') id: string,
  ) {
    return this.service.printData(user, id);
  }
  @RequirePermission(ModuleCode.PERMIT, PermissionAction.READ)
  @Get(':workPermitId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('workPermitId') workPermitId: string,
  ) {
    return this.service.findOne(user, workPermitId);
  }

  @RequirePermission(ModuleCode.PERMIT, PermissionAction.CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateWorkPermitDto) {
    return this.numbering.createDocument(
      user,
      ModuleCode.PERMIT,
      (documentId) =>
        this.service.create(
          user,
          Object.assign({}, dto, { workPermitId: documentId }),
        ),
      dto.attachmentId,
    );
  }

  @RequirePermission(ModuleCode.PERMIT, PermissionAction.UPDATE)
  @Patch(':workPermitId')
  update(
    @CurrentUser() user: UserContext,
    @Param('workPermitId') workPermitId: string,
    @Body() dto: UpdateWorkPermitDto,
  ) {
    return this.numbering.saveDocument(
      user,
      ModuleCode.PERMIT,
      workPermitId,
      dto.attachmentId,
      () => this.service.update(user, workPermitId, dto),
    );
  }

  @RequirePermission(ModuleCode.PERMIT, PermissionAction.DELETE)
  @Delete(':workPermitId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('workPermitId') workPermitId: string,
  ) {
    return this.service.remove(user, workPermitId);
  }
}
