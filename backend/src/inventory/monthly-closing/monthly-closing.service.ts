/** 회사 잠금 아래 기간 Open/Lock과 월별 수불의 산출·검증·저장을 처리한다. */
import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { monthAfter, monthValue } from '../../common/utils/posting-date';
import { decimal, qty } from '../../common/utils/stock-decimal';
import { InventoryDocument } from '../transactions/entities/inventory-document.entity';
import { InventoryPeriodLock } from './entities/inventory-period-lock.entity';
import { MonthlyStockBalance } from './entities/monthly-stock-balance.entity';
import { MonthlyStockValuation } from './entities/monthly-stock-valuation.entity';
import { MonthlyStockInTransit } from './entities/monthly-stock-in-transit.entity';
import { monthlyStocks, replayStock } from '../stock/stock-engine';
import { StockProcessingService } from '../stock/stock-processing.service';
@Injectable()
export class MonthlyClosingService {
  constructor(
    private readonly db: DataSource,
    private readonly stock: StockProcessingService,
  ) {}
  async periods(user: UserContext) {
    return this.db.getRepository(InventoryPeriodLock).find({
      where: { companyId: user.companyId },
      order: { yearMonth: 'DESC' },
    });
  }
  async periodAction(
    user: UserContext,
    month: string,
    action: 'open' | 'unlock' | 'close',
  ) {
    monthValue(month);
    await this.db.transaction(async (manager) => {
      await this.stock.companyLock(manager, user.companyId);
      const repo = manager.getRepository(InventoryPeriodLock);
      let row = await repo.findOneBy({
        companyId: user.companyId,
        yearMonth: month,
      });
      if (action === 'close') {
        if (!row) throw new ConflictException('Open된 월이 아닙니다.');
        const earlier = await repo
          .createQueryBuilder('p')
          .where('p.companyId=:companyId', { companyId: user.companyId })
          .andWhere('p."yearMonth" < :month', { month })
          .orderBy('p.yearMonth', 'DESC')
          .getOne();
        if (earlier && (!earlier.locked || earlier.summaryDirty))
          throw new ConflictException(
            '전월부터 순서대로 수불을 재생성·마감하십시오.',
          );
        if (earlier && earlier.yearMonth !== monthAfter(month, -1))
          throw new ConflictException(
            '전월 수불이 필요합니다. 누락 월을 Open하고 마감하십시오.',
          );
        const drafts = await manager
          .getRepository(InventoryDocument)
          .createQueryBuilder('d')
          .where('d.companyId=:companyId', { companyId: user.companyId })
          .andWhere("d.status='D' AND d.deleteYn='N'")
          .andWhere('d.postingDate LIKE :month', { month: `${month}%` })
          .getCount();
        const all = await this.stock.posted(manager, user.companyId),
          replay = replayStock(all);
        const previousMonth = monthAfter(month, -1),
          previousWarehouses = await manager
            .getRepository(MonthlyStockBalance)
            .find({
              where: { companyId: user.companyId, yearMonth: previousMonth },
            }),
          previousSites = await manager
            .getRepository(MonthlyStockValuation)
            .find({
              where: { companyId: user.companyId, yearMonth: previousMonth },
            });
        const summary = monthlyStocks(
          user.companyId,
          month,
          replay.ledger,
          previousWarehouses,
          previousSites,
        );
        const asOf = replayStock(
          all.filter((d) => d.postingDate.slice(0, 6) <= month),
        );
        for (const site of summary.sites) {
          const actual = asOf.valuations.find(
            (v) => v.siteId === site.siteId && v.materialId === site.materialId,
          );
          if (
            qty(actual?.quantity ?? '0') !== qty(site.closingQuantity) ||
            BigInt(actual?.amount ?? '0') !== BigInt(site.closingAmount)
          )
            throw new ConflictException(
              '월 수불과 Posting 평가 잔액이 일치하지 않습니다.',
            );
        }
        for (const w of summary.warehouses) {
          const actual = asOf.balances.find(
            (b) =>
              b.siteId === w.siteId &&
              b.warehouseId === w.warehouseId &&
              b.materialId === w.materialId,
          );
          if (qty(actual?.quantity ?? '0') !== qty(w.closingQuantity))
            throw new ConflictException('월 창고 수량 불일치입니다.');
        }
        for (const entity of [
          MonthlyStockBalance,
          MonthlyStockValuation,
          MonthlyStockInTransit,
        ])
          await manager
            .getRepository(entity)
            .delete({ companyId: user.companyId, yearMonth: month });
        if (summary.warehouses.length)
          await manager
            .getRepository(MonthlyStockBalance)
            .save(summary.warehouses);
        if (summary.sites.length)
          await manager
            .getRepository(MonthlyStockValuation)
            .save(summary.sites);
        // 이동 중 재고도 다른 월 수불과 동일하게 전월 기말을 기초로 이월한다.
        const previousTransits = await manager
          .getRepository(MonthlyStockInTransit)
          .find({
            where: { companyId: user.companyId, yearMonth: previousMonth },
          });
        const keys = new Set(
          [...previousTransits, ...asOf.transits].map(
            (t) => `${t.outDocumentId}:${t.outItemId}`,
          ),
        );
        const monthlyTransits: MonthlyStockInTransit[] = [];
        for (const key of keys) {
          const [outDocumentId, outItemId] = key.split(':');
          const previous = previousTransits.find(
              (t) =>
                t.outDocumentId === outDocumentId && t.outItemId === outItemId,
            ),
            current = asOf.transits.find(
              (t) =>
                t.outDocumentId === outDocumentId && t.outItemId === outItemId,
            );
          if (!current)
            throw new ConflictException(
              '전월 이동 중 재고와 출고 이력이 불일치합니다.',
            );
          const open = qty(previous?.closingQuantity ?? '0'),
            close = !current.receivedDocumentId ? qty(current.quantity) : 0n,
            openA = BigInt(previous?.closingAmount ?? '0'),
            closeA = !current.receivedDocumentId ? BigInt(current.amount) : 0n,
            dispatched = current.postingDate.startsWith(month)
              ? qty(current.quantity)
              : 0n,
            dispatchedA = current.postingDate.startsWith(month)
              ? BigInt(current.amount)
              : 0n;
          monthlyTransits.push(
            Object.assign(new MonthlyStockInTransit(), {
              companyId: user.companyId,
              yearMonth: month,
              outDocumentId,
              outItemId,
              siteId: current.siteId,
              toSiteId: current.toSiteId,
              materialId: current.materialId,
              openingQuantity: decimal(open),
              dispatchedQuantity: decimal(dispatched),
              receivedQuantity: decimal(open + dispatched - close),
              closingQuantity: decimal(close),
              openingAmount: openA.toString(),
              dispatchedAmount: dispatchedA.toString(),
              receivedAmount: (openA + dispatchedA - closeA).toString(),
              closingAmount: closeA.toString(),
            }),
          );
        }
        if (monthlyTransits.length)
          await manager
            .getRepository(MonthlyStockInTransit)
            .save(monthlyTransits);
        row.locked = true;
        row.summaryDirty = false;
        row.updatedBy = user.userId;
        row.updatedAt = new Date();
        await repo.save(row);
        void drafts;
      } else {
        if (action === 'open' && row?.locked)
          throw new ConflictException(
            '마감 월은 Lock 해제 기능을 사용하십시오.',
          );
        if (!row)
          row = Object.assign(new InventoryPeriodLock(), {
            companyId: user.companyId,
            yearMonth: month,
            locked: false,
            summaryDirty: true,
            createdBy: user.userId,
          });
        else {
          row.locked = false;
          row.summaryDirty = true;
          row.updatedBy = user.userId;
          row.updatedAt = new Date();
        }
        await repo.save(row);
        await repo
          .createQueryBuilder()
          .update()
          .set({ summaryDirty: true })
          .where('"companyId"=:companyId', { companyId: user.companyId })
          .andWhere('"yearMonth">=:month', { month })
          .execute();
      }
    });
    return this.monthly(user, month);
  }
  async monthly(user: UserContext, month: string) {
    monthValue(month);
    const companyId = user.companyId;
    const [period, warehouses, sites, transits, draftCount] = await Promise.all(
      [
        this.db
          .getRepository(InventoryPeriodLock)
          .findOneBy({ companyId, yearMonth: month }),
        this.db.getRepository(MonthlyStockBalance).find({
          where: { companyId, yearMonth: month },
          order: { siteId: 'ASC', warehouseId: 'ASC', materialId: 'ASC' },
        }),
        this.db.getRepository(MonthlyStockValuation).find({
          where: { companyId, yearMonth: month },
          order: { siteId: 'ASC', materialId: 'ASC' },
        }),
        this.db
          .getRepository(MonthlyStockInTransit)
          .find({ where: { companyId, yearMonth: month } }),
        this.db
          .getRepository(InventoryDocument)
          .createQueryBuilder('d')
          .where('d.companyId=:companyId', { companyId })
          .andWhere("d.status='D' AND d.deleteYn='N'")
          .andWhere('d.postingDate LIKE :month', { month: `${month}%` })
          .getCount(),
      ],
    );
    return {
      period,
      warehouses,
      sites,
      transits,
      draftCount,
      nextMonth: monthAfter(month),
    };
  }
}
