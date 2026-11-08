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
import {
  CreatePermitRequestDto,
  SavePermitRequestDto,
} from './dto/work-permit-request.dto';
import { WorkPermitRequestService } from './work-permit-request.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('work-permit-request')
export class WorkPermitRequestController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: WorkPermitRequestService,
  ) {}

  @RequirePermission(AppModuleKey.WORK_PERMIT_REQUEST, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.service.findAll(user);
  }

  @RequirePermission(AppModuleKey.WORK_PERMIT_REQUEST, PermissionAction.READ)
  @Get(':workPermitRequestId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('workPermitRequestId') workPermitRequestId: string,
  ) {
    return this.service.findOne(user, workPermitRequestId);
  }

  @RequirePermission(AppModuleKey.WORK_PERMIT_REQUEST, PermissionAction.CREATE)
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePermitRequestDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.numbering.createDocument(
      user,
      AppModuleKey.WORK_PERMIT_REQUEST,
      requestKey,
      (documentId) =>
        this.service.create(
          user,
          Object.assign({}, dto, { workPermitRequestId: documentId }),
        ),
      (documentId) => this.service.findOne(user, documentId),
      dto.attachmentId,
    );
  }

  @RequirePermission(AppModuleKey.WORK_PERMIT_REQUEST, PermissionAction.UPDATE)
  @Patch(':workPermitRequestId')
  update(
    @CurrentUser() user: UserContext,
    @Param('workPermitRequestId') workPermitRequestId: string,
    @Body() dto: SavePermitRequestDto,
  ) {
    return this.numbering.saveDocument(
      user,
      AppModuleKey.WORK_PERMIT_REQUEST,
      workPermitRequestId,
      dto.attachmentId,
      () => this.service.update(user, workPermitRequestId, dto),
    );
  }

  @RequirePermission(AppModuleKey.WORK_PERMIT_REQUEST, PermissionAction.DELETE)
  @Delete(':workPermitRequestId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('workPermitRequestId') workPermitRequestId: string,
  ) {
    return this.service.remove(user, workPermitRequestId);
  }
  @RequirePermission(AppModuleKey.WORK_PERMIT_REQUEST, PermissionAction.UPDATE)
  @Post(':workPermitRequestId/submit')
  submit(
    @CurrentUser() user: UserContext,
    @Param('workPermitRequestId') id: string,
  ) {
    return this.service.submit(user, id);
  }
}
