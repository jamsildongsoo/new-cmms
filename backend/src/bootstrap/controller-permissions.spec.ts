import { Controller, Get } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  RequirePermission,
  RequirePermissions,
} from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AppModuleKey,
  MODULE_LIST,
  MODULES,
} from '../common/constants/modules';
import { CompaniesController } from '../organization/companies/companies.controller';
import {
  InventoryController,
  StockStatusController,
  StockLedgerController,
  MonthlyClosingController,
} from '../inventory/transactions/inventory.controller';
import { VendorController } from '../purchase/vendor/vendor.controller';
import { ApprovalsController } from '../approvals/approvals.controller';
import { AttachmentsController } from '../attachments/attachments.controller';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { collectControllerPermissions } from './controller-permissions';
import type { ExecutionContext } from '@nestjs/common';

it('uses company Controller declarations, without inventing create/delete rights', () => {
  expect(collectControllerPermissions([CompaniesController])).toEqual([
    'company:read',
    'company:update',
  ]);
});
it('keeps read-only reports and the read/update closing API exact', () => {
  expect(
    collectControllerPermissions([
      StockStatusController,
      StockLedgerController,
      MonthlyClosingController,
    ]),
  ).toEqual([
    'monthly_closing:read',
    'monthly_closing:update',
    'stock_ledger:read',
    'stock_status:read',
  ]);
});
it('deduplicates controller declarations and includes cross-module code initialization', () => {
  const actual = collectControllerPermissions([
    InventoryController,
    VendorController,
    VendorController,
  ]);
  expect(actual).toEqual([
    'code:update',
    'inventory_document:create',
    'inventory_document:delete',
    'inventory_document:read',
    'inventory_document:update',
    'vendor:create',
    'vendor:delete',
    'vendor:read',
    'vendor:update',
  ]);
});
it('records approval/attachment exceptions and retains their JWT-only Controllers', () => {
  expect(MODULES.APPROVAL.rbac).toBe(false);
  expect(MODULES.ATTACHMENT.rbac).toBe(false);
  expect(
    collectControllerPermissions([ApprovalsController, AttachmentsController]),
  ).toEqual([]);
  for (const target of [ApprovalsController, AttachmentsController])
    expect(Reflect.getMetadata(GUARDS_METADATA, target)).toEqual([
      JwtAuthGuard,
    ]);
});
it('supports inherited permission declarations and method overrides', () => {
  @RequirePermission(AppModuleKey.VENDOR, 'read')
  class BaseController {
    @Get() list() {}
  }
  @Controller('fixture')
  class DerivedController extends BaseController {
    @Get('edit') @RequirePermission(AppModuleKey.VENDOR, 'update') edit() {}
  }
  expect(collectControllerPermissions([DerivedController])).toEqual([
    'vendor:read',
    'vendor:update',
  ]);
});
it.each(['unknown:create', 'vendor:unknown', 'vendor:read:extra'])(
  'fails initialization on malformed permission %s',
  (value) => {
    class InvalidController {
      @RequirePermissions(value) operation() {}
    }
    expect(() => collectControllerPermissions([InvalidController])).toThrow(
      'Invalid controller permission',
    );
  },
);
it('does not turn a false registry value into a runtime authorization bypass', () => {
  class MisconfiguredController {
    @RequirePermission('approval', 'read') operation() {}
  }
  expect(collectControllerPermissions([MisconfiguredController])).toEqual([]);
  const context = {
    getHandler: () => MisconfiguredController.prototype.operation,
    getClass: () => MisconfiguredController,
    switchToHttp: () => ({ getRequest: () => ({ user: { permissions: [] } }) }),
  } as unknown as ExecutionContext;
  expect(new PermissionsGuard(new Reflector()).canActivate(context)).toBe(
    false,
  );
});
it('keeps the persisted module keys stable and records policy without duplicated action lists', () => {
  expect(AppModuleKey.WORK_ORDER).toBe('work_order');
  expect(AppModuleKey.APPROVAL).toBe('approval');
  expect(MODULE_LIST).toHaveLength(25);
  expect(new Set(MODULE_LIST.map((m) => m.key)).size).toBe(25);
  for (const module of MODULE_LIST) {
    expect(module.key).toMatch(/^[a-z]+(?:_[a-z]+)*$/);
    expect(module.name.trim()).not.toBe('');
    expect(typeof module.rbac).toBe('boolean');
    expect(module).not.toHaveProperty('actions');
  }
});
