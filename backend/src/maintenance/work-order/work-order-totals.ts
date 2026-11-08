import { BadRequestException } from '@nestjs/common';
import {
  CostItem,
  LaborItem,
  MaterialItem,
} from './entities/work-order.entity';

export function nonNegative(value: number, field: string, precision = 4) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER ||
    Number(value.toFixed(precision)) !== value
  ) {
    throw new BadRequestException(
      `${field} must be a non-negative number with at most ${precision} decimal places`,
    );
  }
  return value;
}
function safe(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new BadRequestException('Total exceeds supported range');
  return Number(value);
}
/** 소수 수량·단가를 정수로 환산해 곱한 뒤 원 단위 반올림한다. */
export function materialAmount(quantity: number, price: number) {
  nonNegative(quantity, 'quantity');
  nonNegative(price, 'unitPrice', 2);
  const scaled = (value: number, digits: number) =>
    BigInt(value.toFixed(digits).replace('.', ''));
  return safe((scaled(quantity, 4) * scaled(price, 2) + 500000n) / 1000000n);
}
export function workOrderTotals(
  labor: LaborItem[],
  materials: MaterialItem[],
  costs: CostItem[],
) {
  const sumMoney = (values: number[]) =>
    safe(
      values.reduce(
        (sum, value) => sum + BigInt(nonNegative(value, 'amount', 0)),
        0n,
      ),
    );
  const materialTotal = sumMoney(materials.map((row) => row.amount));
  const costTotal = sumMoney(costs.map((row) => row.amount));
  const hours =
    safe(
      labor.reduce(
        (sum, row) => sum + BigInt(row.hours.toFixed(4).replace('.', '')),
        0n,
      ),
    ) / 10000;
  return {
    totalHours: hours,
    materialTotal,
    costTotal,
    totalCost: sumMoney([materialTotal, costTotal]),
  };
}
