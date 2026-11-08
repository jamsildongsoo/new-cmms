import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { getMetadataArgsStorage, QueryFailedError, Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { REQUIRED_PERMISSIONS_KEY } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Warehouse } from './entities/warehouse.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

const actor = { companyId: 'A', userId: 'editor' } as UserContext;
function fixture() {
  const rows: Warehouse[] = [];
  const repository = {
    findOneBy: jest.fn(
      async (query: Partial<Warehouse>) =>
        rows.find((row) =>
          Object.entries(query).every(
            ([key, value]) => row[key as keyof Warehouse] === value,
          ),
        ) ?? null,
    ),
    find: jest.fn(async () => rows),
    create: (row: Warehouse) => row,
    save: jest.fn(async (row: Warehouse) => {
      if (!rows.includes(row)) rows.push(row);
      return row;
    }),
  };
  return {
    rows,
    repository,
    service: new WarehousesService(
      repository as unknown as Repository<Warehouse>,
    ),
  };
}

describe('Site-scoped warehouse keys', () => {
  it('uses company/site/warehouse as its primary key', () => {
    const primary = getMetadataArgsStorage().columns.filter(
      (c) => c.target === Warehouse && c.options.primary,
    );
    expect(primary.map((c) => c.propertyName).sort()).toEqual([
      'companyId',
      'siteId',
      'warehouseId',
    ]);
    expect(
      primary.find((c) => c.propertyName === 'siteId')?.options.nullable,
    ).not.toBe(true);
  });
  it('allows the same code at different sites and companies but rejects same-site duplicates including deleted codes', async () => {
    const { service } = fixture();
    await service.create(actor, {
      siteId: 'S1',
      warehouseId: 'W01',
      name: '제1창고',
    });
    await service.create(actor, {
      siteId: 'S2',
      warehouseId: 'W01',
      name: '제2창고',
    });
    await service.create(
      { ...actor, companyId: 'B' },
      { siteId: 'S1', warehouseId: 'W01', name: '다른회사 창고' },
    );
    await expect(
      service.create(actor, { siteId: 'S1', warehouseId: 'W01', name: '중복' }),
    ).rejects.toMatchObject({ status: 409 });
    await service.remove(actor, 'S1', 'W01');
    await expect(
      service.create(actor, {
        siteId: 'S1',
        warehouseId: 'W01',
        name: '번호재사용',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('reads and edits exactly the site/company key without affecting the same warehouse code elsewhere', async () => {
    const { service, repository } = fixture();
    await service.create(actor, {
      siteId: 'S1',
      warehouseId: 'W01',
      name: '창고1',
    });
    await service.create(actor, {
      siteId: 'S2',
      warehouseId: 'W01',
      name: '창고2',
    });
    const saved = await service.update(actor, 'S2', 'W01', { name: '변경2' });
    expect(saved).toMatchObject({
      companyId: 'A',
      siteId: 'S2',
      warehouseId: 'W01',
      name: '변경2',
      createdBy: 'editor',
      updatedBy: 'editor',
    });
    expect((await service.findOne(actor, 'S1', 'W01')).name).toBe('창고1');
    expect(repository.findOneBy).toHaveBeenCalledWith({
      companyId: 'A',
      siteId: 'S2',
      warehouseId: 'W01',
      deleteYn: 'N',
    });
    await expect(
      service.findOne({ ...actor, companyId: 'B' }, 'S1', 'W01'),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.update(actor, 'MISSING', 'W01', { name: '변경' }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('soft deletes only one site key and preserves audit fields', async () => {
    const { service } = fixture();
    await service.create(actor, {
      siteId: 'S1',
      warehouseId: 'W01',
      name: '창고1',
    });
    await service.create(actor, {
      siteId: 'S2',
      warehouseId: 'W01',
      name: '창고2',
    });
    expect(
      await service.remove({ ...actor, userId: 'deleter' }, 'S1', 'W01'),
    ).toMatchObject({
      siteId: 'S1',
      deleteYn: 'Y',
      createdBy: 'editor',
      updatedBy: 'deleter',
    });
    await expect(service.findOne(actor, 'S1', 'W01')).rejects.toMatchObject({
      status: 404,
    });
    expect((await service.findOne(actor, 'S2', 'W01')).deleteYn).toBe('N');
  });
  it('requires site and trims both identifiers', async () => {
    const { service, repository } = fixture();
    await expect(
      service.create(actor, { siteId: ' ', warehouseId: 'W', name: '창고' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.save).not.toHaveBeenCalled();
    expect(
      await service.create(actor, {
        siteId: ' S1 ',
        warehouseId: ' W01 ',
        name: ' 창고 ',
      }),
    ).toMatchObject({ siteId: 'S1', warehouseId: 'W01', name: '창고' });
  });
  it('orders the company list by site then warehouse', async () => {
    const { service, repository } = fixture();
    await service.findAll(actor);
    expect(repository.find).toHaveBeenCalledWith({
      where: { companyId: 'A', deleteYn: 'N' },
      order: { siteId: 'ASC', warehouseId: 'ASC' },
    });
  });
  it('returns conflict when the database detects a duplicate inserted after the precheck', async () => {
    const { service, repository } = fixture();
    repository.save.mockRejectedValueOnce(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate'), { code: '23505' }),
      ),
    );
    await expect(
      service.create(actor, { siteId: 'S1', warehouseId: 'W01', name: '창고' }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('rejects missing site at creation and immutable keys in update DTO', async () => {
    expect(
      await validate(
        plainToInstance(CreateWarehouseDto, {
          warehouseId: 'W01',
          name: '창고',
        }),
      ),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'siteId' })]),
    );
    const errors = await validate(
      plainToInstance(UpdateWarehouseDto, {
        siteId: 'OTHER',
        warehouseId: 'W02',
        companyId: 'B',
        name: '변경',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((e) => e.property).sort()).toEqual([
      'companyId',
      'siteId',
      'warehouseId',
    ]);
  });
});

describe('Warehouse API routing and permissions', () => {
  it('keeps JWT and CRUD permissions guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, WarehousesController)).toEqual([
      JwtAuthGuard,
      PermissionsGuard,
    ]);
  });
  it.each([
    ['findOne', 'read'],
    ['update', 'update'],
    ['remove', 'delete'],
  ] as const)(
    '%s identifies site and warehouse and requires %s',
    (method, action) => {
      expect(
        Reflect.getMetadata(
          PATH_METADATA,
          WarehousesController.prototype[method],
        ),
      ).toBe(':siteId/:warehouseId');
      expect(
        Reflect.getMetadata(
          REQUIRED_PERMISSIONS_KEY,
          WarehousesController.prototype[method],
        ),
      ).toEqual([`warehouse:${action}`]);
    },
  );
});
