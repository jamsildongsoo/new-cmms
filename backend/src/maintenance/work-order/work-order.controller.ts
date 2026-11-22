import { NumberingService } from '../../numbering/numbering.service';
import { SearchWorkOrderDto } from './dto/search-work-order.dto';
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
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { WorkOrderService } from './work-order.service';

/** 작업계획·실적 API. 계획과 실적의 원문 참조 및 자재·공수·비용 계산은 Service가 담당한다. */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('work-order')
export class WorkOrderController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: WorkOrderService,
  ) {}

  @RequirePermission(ModuleCode.WRKORD, PermissionAction.READ)
  @Get()
  findAll(
    @CurrentUser() user: UserContext,
    @Query() query: SearchWorkOrderDto,
  ) {
    return this.service.findAll(user, query);
  }

  @RequirePermission(ModuleCode.WRKORD, PermissionAction.READ)
  @Get('options')
  getOptions(@CurrentUser() user: UserContext) {
    return this.service.getOptions(user);
  }

  @RequirePermission(ModuleCode.WRKORD, PermissionAction.READ)
  @Get(':workOrderId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('workOrderId') workOrderId: string,
  ) {
    return this.service.findOne(user, workOrderId);
  }

  @RequirePermission(ModuleCode.WRKORD, PermissionAction.CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateWorkOrderDto) {
    return this.numbering.createDocument(
      user,
      ModuleCode.WRKORD,
      (documentId) =>
        this.service.create(
          user,
          Object.assign({}, dto, { workOrderId: documentId }),
        ),
      dto.attachmentId,
    );
  }

  @RequirePermission(ModuleCode.WRKORD, PermissionAction.UPDATE)
  @Patch(':workOrderId')
  update(
    @CurrentUser() user: UserContext,
    @Param('workOrderId') workOrderId: string,
    @Body() dto: UpdateWorkOrderDto,
  ) {
    return this.numbering.saveDocument(
      user,
      ModuleCode.WRKORD,
      workOrderId,
      dto.attachmentId,
      () => this.service.update(user, workOrderId, dto),
    );
  }

  @RequirePermission(ModuleCode.WRKORD, PermissionAction.DELETE)
  @Delete(':workOrderId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('workOrderId') workOrderId: string,
  ) {
    return this.service.remove(user, workOrderId);
  }
}
