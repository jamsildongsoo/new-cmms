import { PurchaseOrderModule } from '../purchase/purchase-order/purchase-order.module';
import { PurchaseRequestModule } from '../purchase/purchase-request/purchase-request.module';
import { WorkPermitRequestModule } from '../maintenance/work-permit-request/work-permit-request.module';
import { WorkPermitModule } from '../maintenance/work-permit/work-permit.module';
import { WorkRequestModule } from '../maintenance/work-request/work-request.module';
import { WorkOrderModule } from '../maintenance/work-order/work-order.module';
import { PreventiveMaintenanceModule } from '../maintenance/preventive-maintenance/preventive-maintenance.module';
import { User } from '../identity/users/entities/user.entity';
import { Department } from '../organization/departments/entities/department.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { ApprovalStep } from './entities/approval-step.entity';
import { Approval } from './entities/approval.entity';

@Module({
  imports: [
    PurchaseOrderModule,
    PurchaseRequestModule,
    PreventiveMaintenanceModule,
    WorkOrderModule,
    WorkPermitRequestModule,
    WorkPermitModule,
    WorkRequestModule,
    TypeOrmModule.forFeature([Approval, ApprovalStep, User, Department]),
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
