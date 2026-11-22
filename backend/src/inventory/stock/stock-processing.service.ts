import { averagePrice } from './stock-calculation';
/** 호출자의 회사 잠금·트랜잭션 안에서 해당 창고·자재 잔고만 변경한다. */
import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { decimal, qty, rounded } from '../../common/utils/decimal.util';
import { InventoryDocument } from '../transactions/entities/inventory-document.entity';
import { InventoryItem } from '../transactions/entities/inventory-item.entity';
import { StockBalance } from './entities/stock-balance.entity';

/** 저장 금액은 항상 원금액이다. 출고만 조회·집계 시 음수로 바꾼다. */
export function stockChange(
  type: string,
  item: Pick<InventoryItem, 'quantity' | 'amount'>,
) {
  const sign = type === 'OUT' ? -1n : 1n;
  return {
    quantity: sign * qty(item.quantity, true),
    amount: sign * BigInt(item.amount),
  };
}
@Injectable()
export class StockProcessingService {
  /** 전표 확정·취소·월 잠금 변경이 같은 회사 잠금을 사용해 잔고와 순번 검사의 경합을 막는다. */
  async companyLock(manager: EntityManager, companyId: string) {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`inventory:${companyId}`],
    );
  }
  async apply(
    manager: EntityManager,
    doc: InventoryDocument,
    items: InventoryItem[],
    cancel = false,
  ) {
    const repo = manager.getRepository(StockBalance);
    // 반복 자재도 품목 순서로 계산하고 취소는 역순으로 되돌린다.
    for (const item of cancel ? [...items].reverse() : items) {
      const key = {
        companyId: doc.companyId,
        siteId: doc.siteId,
        warehouseId: doc.warehouseId,
        materialId: item.materialId,
      };
      const balance =
        (await repo.findOneBy(key)) ??
        repo.create({ ...key, quantity: '0', amount: '0' });
      const currentQ = qty(balance.quantity),
        currentA = BigInt(balance.amount);
      if (!cancel && doc.type === 'OUT') {
        const issue = qty(item.quantity);
        if (issue > currentQ || currentQ === 0n)
          throw new ConflictException('창고 재고 수량이 부족합니다.');
        // 전량 출고도 같은 공식이다. 단수 잔액은 보존하고 필요하면 조정 전표로 정리한다.
        item.unitPrice = averagePrice(currentA, currentQ);
        item.amount = rounded(
          BigInt(item.unitPrice) * issue,
          1000000n,
        ).toString();
        const calculation = `출고 계산: 잔고금액 ${currentA} ÷ 잔고수량 ${decimal(currentQ)} → 단가 ${item.unitPrice}원(원 미만 버림); ${item.unitPrice} × ${decimal(issue)} → 출고금액 ${item.amount}원(원 단위 반올림)`;
        item.note = [item.note, calculation].filter(Boolean).join('\n');
      }
      const change = stockChange(doc.type, item),
        sign = cancel ? -1n : 1n;
      const nextQ = currentQ + sign * change.quantity,
        nextA = currentA + sign * change.amount;
      if (nextQ < 0n || nextA < 0n)
        throw new ConflictException(
          '재고 수량 또는 금액은 음수가 될 수 없습니다.',
        );
      balance.quantity = decimal(nextQ);
      balance.amount = nextA.toString();
      await repo.save(balance);
    }
  }
}
