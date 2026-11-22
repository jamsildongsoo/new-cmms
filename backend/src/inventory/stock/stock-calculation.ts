/** 창고 잔고금액/수량의 원 미만을 버린다. 수량은 내부 6자리 배율 값이다. */
export function averagePrice(amount: bigint, quantity: bigint): string {
  return quantity === 0n ? '0' : ((amount * 1000000n) / quantity).toString();
}
