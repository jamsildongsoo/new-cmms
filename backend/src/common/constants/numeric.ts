/** 사용자 입력·표시 기준. DB 수량 및 내부 원가 계산 정밀도와 구분한다. */
export const QUANTITY_DECIMALS = 2;
export const UNIT_PRICE_DECIMALS = 0;
export const NUMERIC_PRECISION = {
  quantity: QUANTITY_DECIMALS,
  unitPrice: UNIT_PRICE_DECIMALS,
} as const;
