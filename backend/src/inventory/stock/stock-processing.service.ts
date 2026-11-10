/** 거래 확정과 월마감이 호출자의 트랜잭션에서 사용하는 회사 잠금·확정 이력·재고 재생을 제공한다. */
import { Injectable } from '@nestjs/common';
import { EntityManager, EntityTarget } from 'typeorm';
import { InventoryDocument } from '../transactions/entities/inventory-document.entity';
import { InventoryItem } from '../transactions/entities/inventory-item.entity';
import { StockBalance } from './entities/stock-balance.entity';
import { StockValuation } from './entities/stock-valuation.entity';
import { StockLedger } from './entities/stock-ledger.entity';
import { StockInTransit } from './entities/stock-in-transit.entity';
import { replayStock } from '../stock/stock-engine';
@Injectable()
export class StockProcessingService {
  async companyLock(manager: EntityManager, companyId: string) {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`inventory:${companyId}`],
    );
  }
  async posted(manager: EntityManager, companyId: string) {
    const docs = await manager.getRepository(InventoryDocument).find({
      where: { companyId, status: 'C', deleteYn: 'N' },
      order: { postingDate: 'ASC', postingSequence: 'ASC' },
    });
    const items = await manager
      .getRepository(InventoryItem)
      .find({ where: { companyId }, order: { sortOrder: 'ASC' } });
    return docs.map((d) =>
      Object.assign({}, d, {
        items: items.filter(
          (i) => i.inventoryDocumentId === d.inventoryDocumentId,
        ),
      }),
    );
  }
  private async replace<T extends object>(
    manager: EntityManager,
    target: EntityTarget<T>,
    companyId: string,
    rows: T[],
  ) {
    await manager.getRepository(target).delete({ companyId } as never);
    if (rows.length) await manager.getRepository(target).save(rows);
  }
  async rebuild(manager: EntityManager, companyId: string) {
    const replay = replayStock(await this.posted(manager, companyId));
    await this.replace(manager, StockBalance, companyId, replay.balances);
    await this.replace(manager, StockValuation, companyId, replay.valuations);
    await this.replace(manager, StockLedger, companyId, replay.ledger);
    await this.replace(manager, StockInTransit, companyId, replay.transits);
    // 입고 원가는 입력 snapshot을 유지하고 출고/이동입고의 평가 결과만 갱신한다.
    const docs = await manager
      .getRepository(InventoryDocument)
      .find({ where: { companyId, status: 'C', deleteYn: 'N' } });
    for (const cost of replay.costs) {
      const doc = docs.find(
        (d) => d.inventoryDocumentId === cost.inventoryDocumentId,
      )!;
      await manager.getRepository(InventoryItem).update(
        {
          companyId,
          inventoryDocumentId: cost.inventoryDocumentId,
          itemId: cost.itemId,
        },
        {
          amount: cost.amount,
          ...(['GENERAL_OUT', 'SITE_OUT', 'SITE_IN'].includes(
            doc.processingKind,
          )
            ? { unitPrice: cost.unitPrice }
            : {}),
        },
      );
    }
    return replay;
  }
}
