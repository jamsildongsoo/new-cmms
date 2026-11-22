import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MetadataController } from '../../system/metadata.controller';
import { PERMISSION_OPTIONS, isPermissionCode } from './permissions';

it('serves fixed metadata with English names, labels and supported variants', () => {
  const result = new MetadataController().metadata();
  expect(result.codeGroups).toContainEqual({
    codeId: 'EQUIP_TYPE',
    name: 'EQUIPMENT_TYPE',
    label: '설비 유형',
  });
  expect(result.documentStatuses).toContainEqual({ value: 'C', label: '완결' });
  expect(result.inventoryVariants).toHaveLength(6);
  expect(result.accessScopes).toHaveLength(3);
  expect(result).not.toHaveProperty('permissions');
  expect(Reflect.getMetadata(GUARDS_METADATA, MetadataController)).toEqual([
    JwtAuthGuard,
  ]);
});
it('provides supported role choices and rejects obsolete permission identifiers', () => {
  expect(PERMISSION_OPTIONS).toContainEqual({
    permissionId: 'USER:read',
    module: 'USER',
    moduleLabel: '사용자',
    action: 'read',
    name: '사용자 조회',
  });
  expect(isPermissionCode('COMP:create')).toBe(false);
  expect(isPermissionCode('PERM:read')).toBe(false);
  expect(isPermissionCode('USER:read')).toBe(true);
});
