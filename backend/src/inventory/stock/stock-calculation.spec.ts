import { averagePrice } from './stock-calculation';
import { qty } from '../../common/utils/decimal.util';
it('floors warehouse average prices and handles zero quantities', () => {
  expect(averagePrice(10000n, qty('6'))).toBe('1666');
  expect(averagePrice(2n, qty('3'))).toBe('0');
  expect(averagePrice(4n, qty('1.25'))).toBe('3');
  expect(averagePrice(2n, 0n)).toBe('0');
});
