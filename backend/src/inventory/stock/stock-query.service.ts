/** 인증 회사의 현재 재고 잔고와 수불부를 조회한다. */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { businessDate } from '../../common/utils/posting-date';
import { StockBalance } from './entities/stock-balance.entity';
import { StockValuation } from './entities/stock-valuation.entity';
import { StockLedger } from './entities/stock-ledger.entity';
import { InventorySearchDto } from '../transactions/dto/inventory.dto';

@Injectable()
export class StockQueryService {
  constructor(private readonly db: DataSource) {}
  async balances(user: UserContext, filter: InventorySearchDto = {}) {
    const where = {
      companyId: user.companyId,
      ...(filter.siteId ? { siteId: filter.siteId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.materialId ? { materialId: filter.materialId } : {}),
    };
    const [warehouses, sites] = await Promise.all([
      this.db.getRepository(StockBalance).find({
        where,
        order: { siteId: 'ASC', warehouseId: 'ASC', materialId: 'ASC' },
      }),
      this.db.getRepository(StockValuation).find({
        where: {
          companyId: user.companyId,
          ...(filter.siteId ? { siteId: filter.siteId } : {}),
          ...(filter.materialId ? { materialId: filter.materialId } : {}),
        },
        order: { siteId: 'ASC', materialId: 'ASC' },
      }),
    ]);
    return { warehouses, sites };
  }
  async ledger(user: UserContext, filter: InventorySearchDto = {}) {
    const q = this.db
      .getRepository(StockLedger)
      .createQueryBuilder('l')
      .where('l.companyId=:companyId', { companyId: user.companyId })
      .orderBy('l.postingDate', 'ASC')
      .addOrderBy('l.postingSequence', 'ASC')
      .addOrderBy('l.entryOrder', 'ASC');
    for (const field of [
      'siteId',
      'warehouseId',
      'materialId',
      'typeCode',
    ] as const)
      if (filter[field])
        q.andWhere(`l.${field}=:${field}`, { [field]: filter[field] });
    if (filter.from)
      q.andWhere('l."postingDate" >= :from', {
        from: businessDate(filter.from),
      });
    if (filter.to)
      q.andWhere('l."postingDate" <= :to', { to: businessDate(filter.to) });
    return q.getMany();
  }
}
