import 'reflect-metadata';
import { globSync } from 'node:fs';
import { resolve } from 'node:path';
import { getMetadataArgsStorage } from 'typeorm';
import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// 새 Entity/Controller가 회사 키 또는 인증 경계를 빠뜨리면 공통 계약 검사에서 드러나도록 한다.
const exportsOf = (pattern: string) =>
  globSync(pattern, { cwd: process.cwd() }).flatMap((file) => {
    const loaded = require(resolve(file)) as Record<string, unknown>;
    return Object.values(loaded).filter((value) => typeof value === 'function');
  });
const entities = exportsOf('src/**/*.entity.ts');
const controllers = exportsOf('src/**/*.controller.ts') as {
  name: string;
  prototype: object;
}[];

it('includes the company in every stored entity key ', () => {
  const metadata = getMetadataArgsStorage();
  const tables = metadata.tables.filter(
    (table) =>
      typeof table.target === 'function' && entities.includes(table.target),
  );
  expect(tables.length).toBeGreaterThan(30);
  for (const table of tables) {
    const company = metadata.columns.find(
      (column) =>
        column.target === table.target && column.propertyName === 'companyId',
    );
    expect({
      entity: table.name,
      primaryCompany: company?.options.primary,
    }).toEqual({ entity: table.name, primaryCompany: true });
  }
});
it('requires JWT except for login, cookie-authenticated refresh, logout, and health', () => {
  let checked = 0;
  for (const controller of controllers) {
    for (const key of Object.getOwnPropertyNames(controller.prototype)) {
      if (key === 'constructor') continue;
      const handler = Object.getOwnPropertyDescriptor(controller.prototype, key)
        ?.value as object | undefined;
      if (
        !handler ||
        Reflect.getMetadata(METHOD_METADATA, handler) === undefined
      )
        continue;
      if (
        (controller.name === 'AuthController' &&
          ['login', 'refresh', 'logout'].includes(key)) ||
        (controller.name === 'HealthController' && key === 'check')
      )
        continue;
      const guards = [
        ...(Reflect.getMetadata(GUARDS_METADATA, controller) ?? []),
        ...(Reflect.getMetadata(GUARDS_METADATA, handler) ?? []),
      ] as unknown[];
      expect({
        operation: `${controller.name}.${key}`,
        authenticated: guards.includes(JwtAuthGuard),
      }).toEqual({
        operation: `${controller.name}.${key}`,
        authenticated: true,
      });
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(100);
});
