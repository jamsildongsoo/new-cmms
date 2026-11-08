import { NumberingService } from '../../numbering/numbering.service';
import { Headers } from '@nestjs/common';
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
import { AppModuleKey } from '../../common/constants/modules';
import { PermissionAction } from '../../common/constants/permissions';
import { CreateWorkRequestDto } from './dto/create-work-request.dto';
import { UpdateWorkRequestDto } from './dto/update-work-request.dto';
import { WorkRequestService } from './work-request.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('work-request')
export class WorkRequestController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: WorkRequestService,
  ) {}

  @RequirePermission(AppModuleKey.WORK_REQUEST, PermissionAction.READ)
  @Get()
  findAll(
    @CurrentUser() user: UserContext,
    @Query() query: SearchWorkRequestDto,
  ) {
    return this.service.findAll(user, query);
  }

  @RequirePermission(AppModuleKey.WORK_REQUEST, PermissionAction.READ)
  @Get('options')
  getOptions(@CurrentUser() user: UserContext) {
    return this.service.getOptions(user);
  }

  @RequirePermission(AppModuleKey.WORK_REQUEST, PermissionAction.READ)
  @Get(':workRequestId/plans')
  relatedPlans(
    @CurrentUser() user: UserContext,
    @Param('workRequestId') id: string,
  ) {
    return this.service.relatedPlans(user, id);
  }

  @RequirePermission(AppModuleKey.WORK_REQUEST, PermissionAction.READ)
  @Get(':workRequestId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('workRequestId') workRequestId: string,
  ) {
    return this.service.findOne(user, workRequestId);
  }

  @RequirePermission(AppModuleKey.WORK_REQUEST, PermissionAction.CREATE)
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateWorkRequestDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.numbering.createDocument(
      user,
      AppModuleKey.WORK_REQUEST,
      requestKey,
      (documentId) =>
        this.service.create(
          user,
          Object.assign({}, dto, { workRequestId: documentId }),
        ),
      (documentId) => this.service.findOne(user, documentId),
      dto.attachmentId,
    );
  }

  @RequirePermission(AppModuleKey.WORK_REQUEST, PermissionAction.UPDATE)
  @Patch(':workRequestId')
  update(
    @CurrentUser() user: UserContext,
    @Param('workRequestId') workRequestId: string,
    @Body() dto: UpdateWorkRequestDto,
  ) {
    return this.numbering.saveDocument(
      user,
      AppModuleKey.WORK_REQUEST,
      workRequestId,
      dto.attachmentId,
      () => this.service.update(user, workRequestId, dto),
    );
  }

  @RequirePermission(AppModuleKey.WORK_REQUEST, PermissionAction.DELETE)
  @Delete(':workRequestId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('workRequestId') workRequestId: string,
  ) {
    return this.service.remove(user, workRequestId);
  }
}
