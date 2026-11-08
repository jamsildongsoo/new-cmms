import { Injectable } from '@nestjs/common';
import { UserContext } from '../../auth/types/user-context.type';
import { PurchaseService } from '../common/purchase.service';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { PurchaseSearchDto } from '../common/purchase.dto';
@Injectable()
export class PurchaseRequestService {
  constructor(private readonly purchases: PurchaseService) {}
  findAll(user: UserContext, query: PurchaseSearchDto = {}) {
    return this.purchases.list('request', user, query);
  }
  findOne(user: UserContext, id: string) {
    return this.purchases.get('request', user, id);
  }
  create(user: UserContext, dto: CreatePurchaseRequestDto) {
    return this.purchases.save('request', user, dto.requestId, dto, true);
  }
  update(user: UserContext, id: string, dto: UpdatePurchaseRequestDto) {
    return this.purchases.save('request', user, id, dto, false);
  }
  remove(user: UserContext, id: string) {
    return this.purchases.remove('request', user, id);
  }
  options(user: UserContext) {
    return this.purchases.options('request', user);
  }
}
