import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { Vendor } from '../vendor/entities/vendor.entity';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseRequestModule } from '../purchase-request/purchase-request.module';
@Module({
  imports: [
    PurchaseRequestModule,
    TypeOrmModule.forFeature([PurchaseOrder, PurchaseOrderItem, Vendor]),
  ],
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService],
  exports: [PurchaseOrderService],
})
export class PurchaseOrderModule {}
