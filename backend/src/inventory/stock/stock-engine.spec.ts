import { randomUUID } from 'node:crypto';
import {
  decimal,
  lineAmount,
  price,
  qty,
} from '../../common/utils/stock-decimal';
import { businessDate, monthAfter } from '../../common/utils/posting-date';
import {
  monthlyStocks,
  PostedDocument,
  replayStock,
} from '../stock/stock-engine';
function doc(
  kind: string,
  quantity: string,
  unitPrice = '10',
  overrides: Partial<PostedDocument> = {},
): PostedDocument {
  return {
    companyId: 'A',
    inventoryDocumentId: randomUUID(),
    documentNo: '',
    title: kind,
    typeCode: kind,
    processingKind: kind,
    postingDate: '20260301',
    postingSequence: '1',
    siteId: 'S1',
    warehouseId: 'W1',
    deptId: 'D',
    toSiteId: null,
    toWarehouseId: null,
    toDeptId: null,
    refModule: null,
    refId: null,
    referenceNo: null,
    attachmentId: null,
    reason: '',
    note: null,
    status: 'C',
    deleteYn: 'N',
    createdBy: 'owner',
    createdAt: new Date(),
    updatedBy: null,
    updatedAt: null,
    items: [
      {
        companyId: 'A',
        inventoryDocumentId: '',
        itemId: randomUUID(),
        sortOrder: 0,
        materialId: 'M1',
        materialName: '자재',
        baseUnit: 'EA',
        spec: null,
        note: null,
        quantity,
        unitPrice,
        amount: lineAmount(
          quantity.startsWith('-') ? quantity.slice(1) : quantity,
          unitPrice,
        ),
        refItemId: null,
      },
    ],
    ...overrides,
  };
}
describe('Stock decimal arithmetic', () => {
  it('rounds line totals exactly without floating point', () => {
    expect(lineAmount('0.1', '0.2')).toBe('0');
    expect(lineAmount('3', '0.5')).toBe('2');
    expect(lineAmount('99999999999999', '0.12345678')).toBe('12345678000000');
    expect(decimal(qty('1.000001') + qty('0.000009'))).toBe('1.00001');
  });
  it.each(['NaN', '1e3', '-1', '1.0000001'])(
    'rejects invalid quantity %s',
    (value) => {
      expect(() => qty(value)).toThrow();
    },
  );
  it('allows signed adjustment quantity and validates dates', () => {
    expect(qty('-1.5', true)).toBe(-1500000n);
    expect(() => price('1.123456789')).toThrow();
    expect(() => businessDate('20260229')).toThrow();
    expect(monthAfter('202612')).toBe('202701');
  });
});
describe('Site valuation and warehouse quantities', () => {
  it('uses the shared site average for issues from either warehouse', () => {
    const a = doc('GENERAL_IN', '10', '10'),
      b = doc('GENERAL_IN', '10', '30', {
        warehouseId: 'W2',
        postingSequence: '2',
      }),
      out = doc('GENERAL_OUT', '5', '0', { postingSequence: '3' });
    const r = replayStock([a, b, out]);
    expect(r.valuations[0]).toMatchObject({
      quantity: '15',
      amount: '300',
      averagePrice: '20',
    });
    expect(r.balances.find((w) => w.warehouseId === 'W1')?.quantity).toBe('5');
    expect(r.costs.at(-1)?.amount).toBe('100');
  });
  it('moves warehouse quantity without changing site money or price', () => {
    const input = doc('GENERAL_IN', '10', '12'),
      move = doc('TRANSFER', '4', '0', {
        toSiteId: 'S1',
        toWarehouseId: 'W2',
        postingSequence: '2',
      });
    const r = replayStock([input, move]);
    expect(r.valuations[0]).toMatchObject({
      quantity: '10',
      amount: '120',
      averagePrice: '12',
    });
    expect(r.balances.map((w) => w.quantity)).toEqual(['6', '4']);
    expect(
      r.ledger
        .filter((l) => l.processingKind === 'TRANSFER')
        .map((l) => l.amountChange),
    ).toEqual(['0', '0']);
  });
  it('keeps the remaining value when one warehouse is emptied and clears value only on full site depletion', () => {
    const a = doc('GENERAL_IN', '1', '1'),
      b = doc('GENERAL_IN', '2', '1', {
        warehouseId: 'W2',
        postingSequence: '2',
      }),
      out = doc('GENERAL_OUT', '1', '0', { postingSequence: '3' });
    expect(replayStock([a, b, out]).valuations[0].amount).toBe('2');
    const last = doc('GENERAL_OUT', '2', '0', {
      warehouseId: 'W2',
      postingSequence: '4',
    });
    expect(replayStock([a, b, out, last]).valuations[0]).toMatchObject({
      quantity: '0',
      amount: '0',
      averagePrice: '0',
    });
  });
  it('rejects stock shortage at an earlier posting point even if a later receipt exists', () => {
    const input = doc('GENERAL_IN', '10', '10', { postingDate: '20260320' }),
      out = doc('GENERAL_OUT', '1', '0', {
        postingDate: '20260310',
        postingSequence: '2',
      });
    expect(() => replayStock([input, out])).toThrow('부족');
  });
  it('revalues subsequent issues after a backdated receipt', () => {
    const first = doc('GENERAL_IN', '10', '10'),
      out = doc('GENERAL_OUT', '5', '0', {
        postingDate: '20260320',
        postingSequence: '2',
      }),
      back = doc('GENERAL_IN', '10', '30', {
        postingDate: '20260310',
        postingSequence: '3',
      });
    expect(replayStock([first, out]).costs.at(-1)?.amount).toBe('50');
    expect(
      replayStock([first, out, back]).costs.find(
        (c) => c.inventoryDocumentId === out.inventoryDocumentId,
      )?.amount,
    ).toBe('100');
  });
  it('handles positive and negative changes under one adjustment type', () => {
    const input = doc('ADJUST', '10', '5'),
      out = doc('ADJUST', '-3', '0', { postingSequence: '2' });
    expect(replayStock([input, out]).valuations[0]).toMatchObject({
      quantity: '7',
      amount: '35',
    });
  });
  it('keeps cross-site dispatch in transit until a separately posted receipt', () => {
    const input = doc('GENERAL_IN', '10', '10'),
      out = doc('SITE_OUT', '4', '0', {
        toSiteId: 'S2',
        toWarehouseId: 'W1',
        toDeptId: 'D2',
        postingDate: '20260331',
        postingSequence: '2',
      });
    const shipped = replayStock([input, out]);
    expect(shipped.valuations[0]).toMatchObject({
      quantity: '6',
      amount: '60',
    });
    expect(shipped.transits[0]).toMatchObject({
      quantity: '4',
      amount: '40',
      receivedDocumentId: null,
    });
    const incoming = doc('SITE_IN', '4', '0', {
      siteId: 'S2',
      refId: out.inventoryDocumentId,
      postingDate: '20260402',
      postingSequence: '3',
    });
    incoming.items[0].refItemId = out.items[0].itemId;
    const received = replayStock([input, out, incoming]);
    expect(received.valuations.find((v) => v.siteId === 'S2')).toMatchObject({
      quantity: '4',
      amount: '40',
      averagePrice: '10',
    });
    expect(received.transits[0].receivedDocumentId).toBe(
      incoming.inventoryDocumentId,
    );
    const duplicate = Object.assign({}, incoming, {
      inventoryDocumentId: randomUUID(),
      postingSequence: '4',
    });
    expect(() => replayStock([input, out, incoming, duplicate])).toThrow(
      '이미 입고',
    );
  });
  it('rejects direct cross-site transfer and wrong receiving destination', () => {
    const input = doc('GENERAL_IN', '10', '10'),
      move = doc('TRANSFER', '1', '0', {
        toSiteId: 'S2',
        toWarehouseId: 'W1',
        postingSequence: '2',
      });
    expect(() => replayStock([input, move])).toThrow('같은 사이트');
    const incoming = doc('SITE_IN', '1', '0', {
      siteId: 'S2',
      refId: 'missing',
      postingSequence: '2',
    });
    incoming.items[0].refItemId = 'missing';
    expect(() => replayStock([input, incoming])).toThrow('원 출고');
  });
  it('rolls monthly quantities and amounts from the previous month closing without counting transfers as receipts', () => {
    const input = doc('GENERAL_IN', '10', '10'),
      move = doc('TRANSFER', '3', '0', {
        toSiteId: 'S1',
        toWarehouseId: 'W2',
        postingSequence: '2',
      }),
      out = doc('GENERAL_OUT', '2', '0', {
        warehouseId: 'W2',
        postingDate: '20260401',
        postingSequence: '3',
      }),
      adjust = doc('ADJUST', '-1', '0', {
        postingDate: '20260402',
        postingSequence: '4',
      });
    const all = replayStock([input, move, out, adjust]),
      march = monthlyStocks('A', '202603', all.ledger, [], []);
    expect(march.warehouses[0]).toMatchObject({
      receiptQuantity: '10',
      transferOutQuantity: '3',
      closingQuantity: '7',
    });
    expect(march.sites[0]).toMatchObject({
      receiptQuantity: '10',
      closingQuantity: '10',
      closingAmount: '100',
    });
    const april = monthlyStocks(
      'A',
      '202604',
      all.ledger,
      march.warehouses,
      march.sites,
    );
    expect(april.sites[0]).toMatchObject({
      openingQuantity: '10',
      openingAmount: '100',
      issueQuantity: '2',
      issueAmount: '20',
      adjustDecreaseQuantity: '1',
      closingQuantity: '7',
      closingAmount: '70',
    });
    const may = monthlyStocks(
      'A',
      '202605',
      all.ledger,
      april.warehouses,
      april.sites,
    );
    expect(may.sites[0]).toMatchObject({
      openingQuantity: '7',
      closingQuantity: '7',
      closingAmount: '70',
    });
  });
});
