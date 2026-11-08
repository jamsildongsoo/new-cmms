import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseRequest } from '../purchase-request/entities/purchase-request.entity';
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { PurchaseRequestItem } from './purchase-request-item.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { PurchaseOrderAllocation } from './purchase-order-allocation.entity';
import { PurchaseService } from './purchase.service';
import { Vendor } from '../vendor/entities/vendor.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseRequest,
      PurchaseOrder,
      PurchaseRequestItem,
      PurchaseOrderItem,
      PurchaseOrderAllocation,
      Vendor,
    ]),
  ],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
