import { SearchPermitDto } from '../work-permit/dto/search-permit.dto';
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
import {
  CreatePermitRequestDto,
  SavePermitRequestDto,
} from './dto/work-permit-request.dto';
import { WorkPermitRequestService } from './work-permit-request.service';

/** 작업허가요청 API. 신청 완료는 허가요청의 확정이며 작업허가서 발행·전자결재와 구분한다. */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('work-permit-request')
export class WorkPermitRequestController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: WorkPermitRequestService,
  ) {}

  @RequirePermission(ModuleCode.PERREQ, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext, @Query() query: SearchPermitDto) {
    return this.service.findAll(user, query);
  }

  @RequirePermission(ModuleCode.PERREQ, PermissionAction.READ)
  @Get(':workPermitRequestId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('workPermitRequestId') workPermitRequestId: string,
  ) {
    return this.service.findOne(user, workPermitRequestId);
  }

  @RequirePermission(ModuleCode.PERREQ, PermissionAction.CREATE)
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePermitRequestDto,
  ) {
    return this.numbering.createDocument(
      user,
      ModuleCode.PERREQ,
      (documentId) =>
        this.service.create(
          user,
          Object.assign({}, dto, { workPermitRequestId: documentId }),
        ),
      dto.attachmentId,
    );
  }

  @RequirePermission(ModuleCode.PERREQ, PermissionAction.UPDATE)
  @Patch(':workPermitRequestId')
  update(
    @CurrentUser() user: UserContext,
    @Param('workPermitRequestId') workPermitRequestId: string,
    @Body() dto: SavePermitRequestDto,
  ) {
    return this.numbering.saveDocument(
      user,
      ModuleCode.PERREQ,
      workPermitRequestId,
      dto.attachmentId,
      () => this.service.update(user, workPermitRequestId, dto),
    );
  }

  @RequirePermission(ModuleCode.PERREQ, PermissionAction.DELETE)
  @Delete(':workPermitRequestId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('workPermitRequestId') workPermitRequestId: string,
  ) {
    return this.service.remove(user, workPermitRequestId);
  }
  @RequirePermission(ModuleCode.PERREQ, PermissionAction.UPDATE)
  @Post(':workPermitRequestId/submit')
  submit(
    @CurrentUser() user: UserContext,
    @Param('workPermitRequestId') id: string,
  ) {
    return this.service.submit(user, id);
  }
}
