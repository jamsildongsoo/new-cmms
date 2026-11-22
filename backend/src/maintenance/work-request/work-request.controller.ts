import { NumberingService } from '../../numbering/numbering.service';
import { SearchWorkRequestDto } from './dto/search-work-request.dto';
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
import { CreateWorkRequestDto } from './dto/create-work-request.dto';
import { UpdateWorkRequestDto } from './dto/update-work-request.dto';
import { WorkRequestService } from './work-request.service';

/** 작업요청 API. 문서 채번·첨부 연결은 공통 서비스를 사용하며 소속 범위·작성자·초안 검사는 업무 Service가 수행한다. */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('work-request')
export class WorkRequestController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: WorkRequestService,
  ) {}

  @RequirePermission(ModuleCode.WRKREQ, PermissionAction.READ)
  @Get()
  findAll(
    @CurrentUser() user: UserContext,
    @Query() query: SearchWorkRequestDto,
  ) {
    return this.service.findAll(user, query);
  }

  @RequirePermission(ModuleCode.WRKREQ, PermissionAction.READ)
  @Get('options')
  getOptions(@CurrentUser() user: UserContext) {
    return this.service.getOptions(user);
  }

  @RequirePermission(ModuleCode.WRKREQ, PermissionAction.READ)
  @Get(':workRequestId/plans')
  relatedPlans(
    @CurrentUser() user: UserContext,
    @Param('workRequestId') id: string,
  ) {
    return this.service.relatedPlans(user, id);
  }

  @RequirePermission(ModuleCode.WRKREQ, PermissionAction.READ)
  @Get(':workRequestId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('workRequestId') workRequestId: string,
  ) {
    return this.service.findOne(user, workRequestId);
  }

  @RequirePermission(ModuleCode.WRKREQ, PermissionAction.CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateWorkRequestDto) {
    return this.numbering.createDocument(
      user,
      ModuleCode.WRKREQ,
      (documentId) =>
        this.service.create(
          user,
          Object.assign({}, dto, { workRequestId: documentId }),
        ),
      dto.attachmentId,
    );
  }

  @RequirePermission(ModuleCode.WRKREQ, PermissionAction.UPDATE)
  @Patch(':workRequestId')
  update(
    @CurrentUser() user: UserContext,
    @Param('workRequestId') workRequestId: string,
    @Body() dto: UpdateWorkRequestDto,
  ) {
    return this.numbering.saveDocument(
      user,
      ModuleCode.WRKREQ,
      workRequestId,
      dto.attachmentId,
      () => this.service.update(user, workRequestId, dto),
    );
  }

  @RequirePermission(ModuleCode.WRKREQ, PermissionAction.DELETE)
  @Delete(':workRequestId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('workRequestId') workRequestId: string,
  ) {
    return this.service.remove(user, workRequestId);
  }
}
