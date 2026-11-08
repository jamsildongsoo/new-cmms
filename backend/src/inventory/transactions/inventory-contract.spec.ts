import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { REQUIRED_PERMISSIONS_KEY } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import {
  InventoryController,
  StockStatusController,
  StockLedgerController,
  MonthlyClosingController,
} from './inventory.controller';
import { SaveInventoryDto } from './dto/inventory.dto';
import { PurchaseSaveDto } from '../../purchase/common/purchase.dto';
import { CreatePurchaseRequestDto } from '../../purchase/purchase-request/dto/create-purchase-request.dto';
import { VendorController } from '../../purchase/vendor/vendor.controller';
import { CreateVendorDto } from '../../purchase/vendor/dto/vendor.dto';
it.each([
  InventoryController,
  StockStatusController,
  StockLedgerController,
  MonthlyClosingController,
  VendorController,
])('%s keeps company authentication and module permissions', (target) => {
  expect(Reflect.getMetadata(GUARDS_METADATA, target)).toEqual([
    JwtAuthGuard,
    PermissionsGuard,
  ]);
});
it.each([
  ['list', 'read'],
  ['get', 'read'],
  ['create', 'create'],
  ['update', 'update'],
  ['remove', 'delete'],
])('guards vendor %s with its own module permission', (method, action) => {
  expect(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      Object.getOwnPropertyDescriptor(VendorController.prototype, method)!
        .value,
    ),
  ).toEqual([`vendor:${action}`]);
});
it('rejects vendor company, audit and soft-delete overrides', async () => {
  const errors = await validate(
    plainToInstance(CreateVendorDto, {
      vendorId: 'V1',
      name: '벤더',
      companyId: 'OTHER',
      deleteYn: 'Y',
      createdBy: 'forged',
    }),
    { whitelist: true, forbidNonWhitelisted: true },
  );
  expect(errors.map((e) => e.property).sort()).toEqual([
    'companyId',
    'createdBy',
    'deleteYn',
  ]);
});
it('requires inventory update permission for direct confirmation, without a new confirm action', () => {
  expect(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      Object.getOwnPropertyDescriptor(InventoryController.prototype, 'confirm')!
        .value,
    ),
  ).toEqual(['inventory_document:update']);
});
it.each(['open', 'unlock', 'close'] as const)(
  'requires monthly_closing:update for %s',
  (method) => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        MonthlyClosingController.prototype[method],
      ),
    ).toEqual(['monthly_closing:update']);
  },
);
it('rejects incoming inventory company/status/processing-kind/audit overrides', async () => {
  const dto = plainToInstance(SaveInventoryDto, {
    title: '입고',
    typeCode: 'GENERAL_IN',
    postingDate: '20260301',
    siteId: 'S1',
    warehouseId: 'W1',
    items: [],
    companyId: 'OTHER',
    status: 'C',
    processingKind: 'SITE_IN',
    createdBy: 'forged',
    transactionDate: '20260301',
  });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  expect(errors.map((e) => e.property).sort()).toEqual([
    'companyId',
    'createdBy',
    'processingKind',
    'status',
    'transactionDate',
  ]);
});
it('allows optional purchase order documentNo', async () => {
  expect(
    await validate(
      plainToInstance(PurchaseSaveDto, {
        title: '구매발주',
        items: [{ materialId: 'M1', quantity: '1', unitPrice: null }],
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    ),
  ).toHaveLength(0);
});
it('accepts a quantity-only request and rejects prices and amounts in request payloads', async () => {
  const payload = {
    requestId: '138f07fe-b076-4f46-9193-a926fa159206',
    title: '비교 견적은 첨부',
    items: [{ materialId: 'M1', quantity: '2' }],
  };
  const settings = { whitelist: true, forbidNonWhitelisted: true };
  expect(
    await validate(
      plainToInstance(CreatePurchaseRequestDto, payload),
      settings,
    ),
  ).toHaveLength(0);
  const errors = await validate(
    plainToInstance(CreatePurchaseRequestDto, {
      ...payload,
      items: [{ ...payload.items[0], unitPrice: '10', amount: '20' }],
      totalAmount: '20',
    }),
    settings,
  );
  expect(JSON.stringify(errors)).toContain('unitPrice');
  expect(JSON.stringify(errors)).toContain('amount');
  expect(errors.some((e) => e.property === 'totalAmount')).toBe(true);
});
