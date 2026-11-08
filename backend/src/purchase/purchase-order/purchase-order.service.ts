import { Injectable } from '@nestjs/common';
import { UserContext } from '../../auth/types/user-context.type';
import { PurchaseService } from '../common/purchase.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseSearchDto } from '../common/purchase.dto';
@Injectable()
export class PurchaseOrderService {
  constructor(private readonly purchases: PurchaseService) {}
  findAll(user: UserContext, query: PurchaseSearchDto = {}) {
    return this.purchases.list('order', user, query);
  }
  findOne(user: UserContext, id: string) {
    return this.purchases.get('order', user, id);
  }
  create(user: UserContext, dto: CreatePurchaseOrderDto) {
    return this.purchases.save('order', user, dto.orderId, dto, true);
  }
  update(user: UserContext, id: string, dto: UpdatePurchaseOrderDto) {
    return this.purchases.save('order', user, id, dto, false);
  }
  remove(user: UserContext, id: string) {
    return this.purchases.remove('order', user, id);
  }
  options(user: UserContext) {
    return this.purchases.options('order', user);
  }
}
