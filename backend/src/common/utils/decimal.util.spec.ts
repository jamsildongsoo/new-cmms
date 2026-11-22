import { getMetadataArgsStorage } from 'typeorm';
import { InventoryItem } from '../../inventory/transactions/entities/inventory-item.entity';
import { PurchaseOrderItem } from '../../purchase/purchase-order/entities/purchase-order-item.entity';
import { decimal, inputPrice, inputQuantity, price, qty } from './decimal.util';

it('accepts two quantity decimals and whole won prices but rejects new finer inputs', () => {
  expect(decimal(inputQuantity('1.23'))).toBe('1.23');
  expect(decimal(inputQuantity('-1.23', true))).toBe('-1.23');
  expect(inputPrice('123.00000000')).toBe(price('123'));
  expect(() => inputQuantity('1.234')).toThrow('소수점 2자리');
  expect(() => inputPrice('1.5')).toThrow('소수점 0자리');
  expect(() => inputQuantity('-1.23')).toThrow();
});
it('retains exact historical quantities and calculation precision without silently rounding them', () => {
  expect(inputQuantity('1.234560', false, '1.23456')).toBe(qty('1.23456'));
  expect(() => inputQuantity('1.23457', false, '1.23456')).toThrow();
  expect(decimal(qty('0.000001'))).toBe('0.000001');
  expect(price('1.12345678')).toBe(112345678n);
});
it('stores unit and average prices as integers while retaining quantity precision', () => {
  const columns = getMetadataArgsStorage().columns;
  for (const [entity, field] of [
    [InventoryItem, 'unitPrice'],
    [PurchaseOrderItem, 'unitPrice'],
  ] as const) {
    expect(
      columns.find((c) => c.target === entity && c.propertyName === field)
        ?.options,
    ).toMatchObject({ scale: 0 });
  }
  expect(
    columns.find(
      (c) => c.target === InventoryItem && c.propertyName === 'quantity',
    )?.options,
  ).toMatchObject({ scale: 6 });
});
