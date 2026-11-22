import { averagePrice } from './stock-calculation';
/** 현재고는 잔고에서, 기간 집계는 확정 전표에서 조회한다. 저장 원가는 재평가하지 않는다. */
import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import {
  businessDate,
  monthAfter,
  monthValue,
} from '../../common/utils/date.util';
import { decimal, qty } from '../../common/utils/decimal.util';
import { StockBalance } from './entities/stock-balance.entity';
import { InventoryDocument } from '../transactions/entities/inventory-document.entity';
import { InventoryItem } from '../transactions/entities/inventory-item.entity';
import { InventorySearchDto } from '../transactions/dto/inventory.dto';
import { stockChange } from './stock-processing.service';

type Entry = Pick<
  InventoryDocument,
  | 'inventoryDocumentId'
  | 'postingDate'
  | 'postingSequence'
  | 'siteId'
  | 'warehouseId'
  | 'type'
  | 'kind'
> &
  Pick<
    InventoryItem,
    'itemId' | 'materialId' | 'quantity' | 'amount' | 'sortOrder'
  >;
@Injectable()
export class StockQueryService {
  constructor(private readonly db: DataSource) {}
  private scopeSite(user: UserContext) {
    if (user.accessScope === 'COMPANY_ALL') return undefined;
    if (
      (user.accessScope === 'OWN_SITE' ||
        user.accessScope === 'OWN_DEPARTMENT') &&
      user.siteId
    )
      return user.siteId;
    throw new ForbiddenException('재고 조회 범위 또는 소속 사업장이 없습니다.');
  }
  async balances(user: UserContext, filter: InventorySearchDto = {}) {
    const scope = this.scopeSite(user);
    const q = this.db
      .getRepository(StockBalance)
      .createQueryBuilder('b')
      .where('b.companyId=:companyId', { companyId: user.companyId });
    if (scope) q.andWhere('b.siteId=:scope', { scope });
    for (const field of ['siteId', 'warehouseId', 'materialId'] as const)
      if (filter[field])
        q.andWhere(`b.${field}=:${field}`, { [field]: filter[field] });
    const balances = await q
      .orderBy('b.siteId', 'ASC')
      .addOrderBy('b.warehouseId', 'ASC')
      .addOrderBy('b.materialId', 'ASC')
      .getMany();
    const warehouses = balances.map((b) =>
      Object.assign({}, b, {
        averagePrice:
          qty(b.quantity) === 0n
            ? null
            : averagePrice(BigInt(b.amount), qty(b.quantity)),
      }),
    );
    const groups = new Map<
      string,
      {
        companyId: string;
        siteId: string;
        materialId: string;
        quantity: bigint;
        amount: bigint;
      }
    >();
    for (const b of balances) {
      const key = JSON.stringify([b.siteId, b.materialId]);
      const group = groups.get(key) ?? {
        companyId: b.companyId,
        siteId: b.siteId,
        materialId: b.materialId,
        quantity: 0n,
        amount: 0n,
      };
      group.quantity += qty(b.quantity);
      group.amount += BigInt(b.amount);
      groups.set(key, group);
    }
    return {
      warehouses,
      sites: [...groups.values()].map((b) => ({
        ...b,
        quantity: decimal(b.quantity),
        amount: b.amount.toString(),
        averagePrice:
          b.quantity === 0n ? null : averagePrice(b.amount, b.quantity),
      })),
    };
  }
  private async entries(user: UserContext, filter: InventorySearchDto = {}) {
    const scope = this.scopeSite(user);
    const q = this.db
      .getRepository(InventoryDocument)
      .createQueryBuilder('d')
      .innerJoin(
        InventoryItem,
        'i',
        'i."companyId" = d."companyId" AND i."inventoryDocumentId" = d."inventoryDocumentId"',
      )
      .where('d.companyId=:companyId', { companyId: user.companyId })
      .andWhere("d.status='C' AND d.deleteYn='N'");
    if (scope) q.andWhere('d.siteId=:scope', { scope });
    for (const field of ['siteId', 'warehouseId'] as const)
      if (filter[field])
        q.andWhere(`d.${field}=:${field}`, { [field]: filter[field] });
    if (filter.materialId)
      q.andWhere('i.materialId=:materialId', { materialId: filter.materialId });
    if (filter.to)
      q.andWhere('d."postingDate" <= :to', { to: businessDate(filter.to) });
    q.select([]);
    for (const field of [
      'inventoryDocumentId',
      'postingDate',
      'postingSequence',
      'siteId',
      'warehouseId',
      'type',
      'kind',
    ])
      q.addSelect(`d.${field}`, field);
    for (const field of [
      'itemId',
      'materialId',
      'quantity',
      'amount',
      'sortOrder',
    ])
      q.addSelect(`i.${field}`, field);
    return q
      .orderBy('d.postingSequence', 'ASC')
      .addOrderBy('i.sortOrder', 'ASC')
      .getRawMany<Entry>();
  }
  async ledger(user: UserContext, filter: InventorySearchDto = {}) {
    const from = filter.from ? businessDate(filter.from) : undefined;
    const balances = new Map<string, { quantity: bigint; amount: bigint }>();
    const result: (Entry & {
      quantityChange: string;
      amountChange: string;
      balanceQuantity: string;
      balanceAmount: string;
    })[] = [];
    for (const row of await this.entries(user, filter)) {
      const key = JSON.stringify([row.siteId, row.warehouseId, row.materialId]);
      const b = balances.get(key) ?? { quantity: 0n, amount: 0n },
        change = stockChange(row.type, row);
      b.quantity += change.quantity;
      b.amount += change.amount;
      balances.set(key, b);
      if (
        (from && row.postingDate < from) ||
        (filter.type && row.type !== filter.type) ||
        (filter.kind && row.kind !== filter.kind)
      )
        continue;
      result.push({
        ...row,
        quantityChange: decimal(change.quantity),
        amountChange: change.amount.toString(),
        balanceQuantity: decimal(b.quantity),
        balanceAmount: b.amount.toString(),
      });
    }
    return result;
  }
  /** 확정 전표의 전월까지 증감은 기초, 대상 월 증감은 당월로 구분한다. 별도 월 수불 테이블은 없다. */
  async monthly(user: UserContext, month: string) {
    monthValue(month);
    const nextMonth = monthAfter(month);
    const groups = new Map<
      string,
      {
        siteId: string;
        warehouseId: string;
        materialId: string;
        values: Record<string, bigint>;
      }
    >();
    // 대상 월까지의 확정 전표로 기초와 당월 증감을 집계한다.
    const end = new Date(
      Date.UTC(
        Number(nextMonth.slice(0, 4)),
        Number(nextMonth.slice(4)) - 1,
        0,
      ),
    ).getUTCDate();
    for (const row of await this.entries(user, { to: `${month}${end}` })) {
      const key = JSON.stringify([row.siteId, row.warehouseId, row.materialId]);
      const group = groups.get(key) ?? {
        siteId: row.siteId,
        warehouseId: row.warehouseId,
        materialId: row.materialId,
        values: {},
      };
      const change = stockChange(row.type, row);
      const bucket =
        row.postingDate.slice(0, 6) < month
          ? 'opening'
          : row.type === 'IN'
            ? 'receipt'
            : row.type === 'OUT'
              ? 'issue'
              : 'adjust';
      for (const [suffix, value] of [
        ['Quantity', change.quantity],
        ['Amount', change.amount],
      ] as const)
        group.values[bucket + suffix] =
          (group.values[bucket + suffix] ?? 0n) + value;
      groups.set(key, group);
    }
    const warehouses = [...groups.values()].map(({ values, ...key }) => {
      const result: Record<string, string> = { ...key };
      for (const suffix of ['Quantity', 'Amount']) {
        let closing = 0n;
        for (const bucket of ['opening', 'receipt', 'issue', 'adjust']) {
          const value = values[bucket + suffix] ?? 0n;
          closing += value;
          result[bucket + suffix] =
            suffix === 'Quantity' ? decimal(value) : value.toString();
        }
        result['closing' + suffix] =
          suffix === 'Quantity' ? decimal(closing) : closing.toString();
      }
      return result;
    });
    return { warehouses, nextMonth };
  }
}
