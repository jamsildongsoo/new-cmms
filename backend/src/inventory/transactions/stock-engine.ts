/** 확정 이력을 postingDate·회사 확정순번·품목 순으로 재생하여 창고 수량과 사업장 평가를 계산한다. */
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  average,
  decimal,
  lineAmount,
  qty,
  rounded,
} from '../../common/utils/stock-decimal';
import {
  InventoryDocument,
  InventoryItem,
  StockBalance,
  StockLedger,
  StockValuation,
  StockInTransit,
  MonthlyStockBalance,
  MonthlyStockValuation,
} from './entities/inventory.entity';
export const STOCK_KINDS = [
  'GENERAL_IN',
  'PURCHASE_IN',
  'SITE_IN',
  'GENERAL_OUT',
  'SITE_OUT',
  'TRANSFER',
  'ADJUST',
] as const;
export type StockKind = (typeof STOCK_KINDS)[number];
export const STOCK_TYPE_DEFAULTS = [
  ['GENERAL_IN', '일반입고', 'GENERAL_IN'],
  ['PURCHASE_IN', '구매오더입고', 'PURCHASE_IN'],
  ['SITE_IN', '타사업장입고', 'SITE_IN'],
  ['GENERAL_OUT', '일반출고', 'GENERAL_OUT'],
  ['SITE_OUT', '타사업장출고', 'SITE_OUT'],
  ['TRANSFER', '이동', 'TRANSFER'],
  ['ADJUST', '조정', 'ADJUST'],
  ['RECEIPT_CANCEL_OUT', '입고취소출고', 'GENERAL_OUT'],
] as const;
export type PostedDocument = InventoryDocument & { items: InventoryItem[] };
const key = (...parts: string[]) => JSON.stringify(parts);
function fail(message: string): never {
  throw new BadRequestException(message);
}
/** Posting 순서로 재생한다. 평가 영역은 사이트, 수량 영역은 창고이며 계산 중 금액은 BigInt이다. */
export function replayStock(documents: PostedDocument[]) {
  const warehouse = new Map<
    string,
    {
      siteId: string;
      warehouseId: string;
      materialId: string;
      quantity: bigint;
    }
  >();
  const valuation = new Map<
    string,
    { siteId: string; materialId: string; quantity: bigint; amount: bigint }
  >();
  const transit = new Map<string, StockInTransit>();
  const ledger: StockLedger[] = [],
    costs: {
      inventoryDocumentId: string;
      itemId: string;
      amount: string;
      unitPrice: string;
    }[] = [];
  const sorted = [...documents].sort(
    (a, b) =>
      a.postingDate.localeCompare(b.postingDate) ||
      (BigInt(a.postingSequence ?? '0') < BigInt(b.postingSequence ?? '0')
        ? -1
        : BigInt(a.postingSequence ?? '0') > BigInt(b.postingSequence ?? '0')
          ? 1
          : 0),
  );
  for (const doc of sorted) {
    if (!STOCK_KINDS.includes(doc.processingKind as StockKind))
      fail('알 수 없는 수불 실행 유형입니다.');
    for (const item of [...doc.items].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )) {
      const quantity = qty(item.quantity, true);
      if (quantity === 0n || (doc.processingKind !== 'ADJUST' && quantity < 0n))
        fail('유효한 수량을 입력하십시오.');
      const vk = key(doc.siteId, item.materialId),
        wk = key(doc.siteId, doc.warehouseId, item.materialId);
      const v = valuation.get(vk) ?? {
        siteId: doc.siteId,
        materialId: item.materialId,
        quantity: 0n,
        amount: 0n,
      };
      valuation.set(vk, v);
      const w = warehouse.get(wk) ?? {
        siteId: doc.siteId,
        warehouseId: doc.warehouseId,
        materialId: item.materialId,
        quantity: 0n,
      };
      warehouse.set(wk, w);
      const apply = (
        target: typeof w,
        q: bigint,
        amount: bigint,
        leg: string,
      ) => {
        target.quantity += q;
        if (target.quantity < 0n)
          fail(
            `${doc.postingDate}: ${item.materialId} 창고 재고가 부족합니다.`,
          );
        ledger.push(
          Object.assign(new StockLedger(), {
            companyId: doc.companyId,
            ledgerId: `${doc.inventoryDocumentId}:${item.itemId}:${leg}`,
            inventoryDocumentId: doc.inventoryDocumentId,
            itemId: item.itemId,
            postingDate: doc.postingDate,
            postingSequence: doc.postingSequence!,
            entryOrder: ledger.length,
            typeCode: doc.typeCode,
            processingKind: doc.processingKind,
            siteId: target.siteId,
            warehouseId: target.warehouseId,
            materialId: item.materialId,
            quantityChange: decimal(q),
            amountChange: amount.toString(),
            balanceQuantity: decimal(target.quantity),
            siteQuantity: decimal(v.quantity),
            siteAmount: v.amount.toString(),
            averagePrice: average(v.amount, v.quantity),
          }),
        );
      };
      const receipt = (q: bigint, amount: bigint) => {
        v.quantity += q;
        v.amount += amount;
        apply(w, q, amount, 'IN');
      };
      const issue = (q: bigint) => {
        if (w.quantity < q || v.quantity < q)
          fail(`${doc.postingDate}: ${item.materialId} 재고가 부족합니다.`);
        const amount =
          q === v.quantity ? v.amount : rounded(v.amount * q, v.quantity);
        v.quantity -= q;
        v.amount -= amount;
        apply(w, -q, -amount, 'OUT');
        return amount;
      };
      let amount = 0n;
      switch (doc.processingKind as StockKind) {
        case 'GENERAL_IN':
        case 'PURCHASE_IN':
          amount = BigInt(lineAmount(item.quantity, item.unitPrice));
          receipt(quantity, amount);
          break;
        case 'GENERAL_OUT':
        case 'SITE_OUT':
          amount = issue(quantity);
          if (doc.processingKind === 'SITE_OUT') {
            if (
              !doc.toSiteId ||
              !doc.toWarehouseId ||
              doc.toSiteId === doc.siteId
            )
              fail('타사업장출고의 도착 사업장·창고가 잘못되었습니다.');
            transit.set(
              key(doc.inventoryDocumentId, item.itemId),
              Object.assign(new StockInTransit(), {
                companyId: doc.companyId,
                outDocumentId: doc.inventoryDocumentId,
                outItemId: item.itemId,
                siteId: doc.siteId,
                warehouseId: doc.warehouseId,
                toSiteId: doc.toSiteId,
                toWarehouseId: doc.toWarehouseId,
                toDeptId: doc.toDeptId,
                materialId: item.materialId,
                materialName: item.materialName,
                baseUnit: item.baseUnit,
                spec: item.spec,
                quantity: item.quantity,
                amount: amount.toString(),
                postingDate: doc.postingDate,
                receivedDocumentId: null,
              }),
            );
          }
          break;
        case 'SITE_IN': {
          const source = transit.get(
            key(doc.refId ?? '', item.refItemId ?? ''),
          );
          if (
            !source ||
            source.receivedDocumentId ||
            source.toSiteId !== doc.siteId ||
            source.toWarehouseId !== doc.warehouseId ||
            source.materialId !== item.materialId ||
            qty(source.quantity) !== quantity
          )
            fail('원 출고·목적지·수량이 일치하지 않거나 이미 입고되었습니다.');
          if (doc.postingDate < source.postingDate)
            fail('출고 posting date보다 앞서 입고할 수 없습니다.');
          amount = BigInt(source.amount);
          receipt(quantity, amount);
          source.receivedDocumentId = doc.inventoryDocumentId;
          break;
        }
        case 'TRANSFER': {
          if (
            doc.toSiteId !== doc.siteId ||
            !doc.toWarehouseId ||
            doc.toWarehouseId === doc.warehouseId
          )
            fail('이동은 같은 사이트의 서로 다른 창고만 가능합니다.');
          const tk = key(doc.siteId, doc.toWarehouseId, item.materialId),
            target = warehouse.get(tk) ?? {
              siteId: doc.siteId,
              warehouseId: doc.toWarehouseId,
              materialId: item.materialId,
              quantity: 0n,
            };
          warehouse.set(tk, target);
          apply(w, -quantity, 0n, 'TRANSFER_OUT');
          apply(target, quantity, 0n, 'TRANSFER_IN');
          break;
        }
        case 'ADJUST':
          if (quantity > 0n) {
            amount = BigInt(lineAmount(item.quantity, item.unitPrice));
            receipt(quantity, amount);
          } else amount = issue(-quantity);
          break;
      }
      if (v.quantity < 0n || v.amount < 0n)
        fail('음수 재고·평가금액은 허용되지 않습니다.');
      costs.push({
        inventoryDocumentId: doc.inventoryDocumentId,
        itemId: item.itemId,
        amount: amount.toString(),
        unitPrice:
          doc.processingKind === 'TRANSFER'
            ? '0'
            : average(amount, quantity < 0n ? -quantity : quantity),
      });
    }
  }
  const companyId = sorted[0]?.companyId ?? '';
  return {
    balances: [...warehouse.values()].map((w) =>
      Object.assign(new StockBalance(), {
        companyId,
        ...w,
        quantity: decimal(w.quantity),
      }),
    ),
    valuations: [...valuation.values()].map((v) =>
      Object.assign(new StockValuation(), {
        companyId,
        ...v,
        quantity: decimal(v.quantity),
        amount: v.amount.toString(),
        averagePrice: average(v.amount, v.quantity),
      }),
    ),
    transits: [...transit.values()],
    ledger,
    costs,
  };
}
const quantityFields = [
  'openingQuantity',
  'receiptQuantity',
  'issueQuantity',
  'transferInQuantity',
  'transferOutQuantity',
  'adjustIncreaseQuantity',
  'adjustDecreaseQuantity',
  'closingQuantity',
] as const;
const amountFields = [
  'openingAmount',
  'receiptAmount',
  'issueAmount',
  'adjustIncreaseAmount',
  'adjustDecreaseAmount',
  'closingAmount',
] as const;
/** 전월 기말을 기초로 가져오며 이동은 입출고에 이중 집계하지 않는다. */
export function monthlyStocks(
  companyId: string,
  yearMonth: string,
  ledger: StockLedger[],
  previousWarehouses: MonthlyStockBalance[],
  previousSites: MonthlyStockValuation[],
) {
  const ws = new Map<string, MonthlyStockBalance>(),
    ss = new Map<string, MonthlyStockValuation>();
  const newWarehouse = (
    siteId: string,
    warehouseId: string,
    materialId: string,
  ) =>
    Object.assign(
      new MonthlyStockBalance(),
      { companyId, yearMonth, siteId, warehouseId, materialId },
      Object.fromEntries(quantityFields.map((f) => [f, '0'])),
    );
  const newSite = (siteId: string, materialId: string) =>
    Object.assign(
      new MonthlyStockValuation(),
      { companyId, yearMonth, siteId, materialId, averagePrice: '0' },
      Object.fromEntries(
        [...quantityFields, ...amountFields].map((f) => [f, '0']),
      ),
    );
  for (const old of previousWarehouses) {
    const row = newWarehouse(old.siteId, old.warehouseId, old.materialId);
    row.openingQuantity = old.closingQuantity;
    ws.set(key(old.siteId, old.warehouseId, old.materialId), row);
  }
  for (const old of previousSites) {
    const row = newSite(old.siteId, old.materialId);
    row.openingQuantity = old.closingQuantity;
    row.openingAmount = old.closingAmount;
    ss.set(key(old.siteId, old.materialId), row);
  }
  const addQ = (
    row: Pick<MonthlyStockBalance, (typeof quantityFields)[number]>,
    f: (typeof quantityFields)[number],
    q: bigint,
  ) => {
    row[f] = decimal(qty(row[f]) + q);
  };
  const addA = (
    row: MonthlyStockValuation,
    f: (typeof amountFields)[number],
    a: bigint,
  ) => {
    row[f] = (BigInt(row[f]) + a).toString();
  };
  for (const entry of ledger.filter((l) =>
    l.postingDate.startsWith(yearMonth),
  )) {
    const wk = key(entry.siteId, entry.warehouseId, entry.materialId),
      sk = key(entry.siteId, entry.materialId),
      w =
        ws.get(wk) ??
        newWarehouse(entry.siteId, entry.warehouseId, entry.materialId),
      s = ss.get(sk) ?? newSite(entry.siteId, entry.materialId);
    ws.set(wk, w);
    ss.set(sk, s);
    const q = qty(entry.quantityChange, true),
      a = BigInt(entry.amountChange),
      positive = q > 0n;
    const qf =
      entry.processingKind === 'TRANSFER'
        ? positive
          ? 'transferInQuantity'
          : 'transferOutQuantity'
        : entry.processingKind === 'ADJUST'
          ? positive
            ? 'adjustIncreaseQuantity'
            : 'adjustDecreaseQuantity'
          : positive
            ? 'receiptQuantity'
            : 'issueQuantity';
    addQ(w, qf, positive ? q : -q);
    addQ(s, qf, positive ? q : -q);
    if (entry.processingKind !== 'TRANSFER') {
      const af =
        entry.processingKind === 'ADJUST'
          ? positive
            ? 'adjustIncreaseAmount'
            : 'adjustDecreaseAmount'
          : positive
            ? 'receiptAmount'
            : 'issueAmount';
      addA(s, af, positive ? a : -a);
    }
  }
  for (const w of ws.values())
    w.closingQuantity = decimal(
      qty(w.openingQuantity) +
        qty(w.receiptQuantity) -
        qty(w.issueQuantity) +
        qty(w.transferInQuantity) -
        qty(w.transferOutQuantity) +
        qty(w.adjustIncreaseQuantity) -
        qty(w.adjustDecreaseQuantity),
    );
  for (const s of ss.values()) {
    s.closingQuantity = decimal(
      qty(s.openingQuantity) +
        qty(s.receiptQuantity) -
        qty(s.issueQuantity) +
        qty(s.adjustIncreaseQuantity) -
        qty(s.adjustDecreaseQuantity),
    );
    s.closingAmount = (
      BigInt(s.openingAmount) +
      BigInt(s.receiptAmount) -
      BigInt(s.issueAmount) +
      BigInt(s.adjustIncreaseAmount) -
      BigInt(s.adjustDecreaseAmount)
    ).toString();
    s.averagePrice = average(BigInt(s.closingAmount), qty(s.closingQuantity));
    const sum = [...ws.values()]
      .filter((w) => w.siteId === s.siteId && w.materialId === s.materialId)
      .reduce((a, w) => a + qty(w.closingQuantity), 0n);
    if (sum !== qty(s.closingQuantity))
      throw new ConflictException('사이트/창고 월 수량이 일치하지 않습니다.');
  }
  return { warehouses: [...ws.values()], sites: [...ss.values()] };
}
