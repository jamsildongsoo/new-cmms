import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { getMetadataArgsStorage, QueryFailedError, Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { REQUIRED_PERMISSIONS_KEY } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CodeValidationService } from '../../codes/code-validation.service';
import { Material } from './entities/material.entity';
import { MaterialController } from './material.controller';
import { MaterialService } from './material.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

const actor = { companyId: 'A', userId: 'editor' } as UserContext;
const payload = {
  materialId: 'MAT-1',
  name: '베어링',
  typeCode: 'PART',
  baseUnit: 'EA',
};
function fixture() {
  const row = {
    ...payload,
    companyId: 'A',
    attachmentId: 'files',
    spec: null,
    maker: null,
    model: null,
    note: null,
    deleteYn: 'N',
    createdBy: 'other-owner',
    createdAt: new Date(),
    updatedBy: null,
    updatedAt: null,
  } as Material;
  const builder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(async () => [[row], 1]),
  };
  const types = {
    find: jest.fn(async () => [{ codeItemId: 'PART', name: '부품' }]),
  };
  const repository = {
    findOneBy: jest.fn(
      async (_query: Partial<Material>) => row as Material | null,
    ),
    create: (value: Material) => value,
    save: jest.fn(async (value: Material) => value),
    createQueryBuilder: () => builder,
    manager: { getRepository: () => types },
  };
  const codes = { assertValidItem: jest.fn(async () => undefined) };
  const service = new MaterialService(
    repository as unknown as Repository<Material>,
    codes as unknown as CodeValidationService,
  );
  return { row, repository, builder, codes, types, service };
}

describe('Material master', () => {
  it('uses company and material code as primary keys without a document status', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === Material,
    );
    expect(
      columns
        .filter((c) => c.options.primary)
        .map((c) => c.propertyName)
        .sort(),
    ).toEqual(['companyId', 'materialId']);
    expect(columns.some((c) => c.propertyName === 'status')).toBe(false);
  });
  it('creates normalized master fields under the authenticated company and actor', async () => {
    const { service, repository, codes } = fixture();
    repository.findOneBy.mockResolvedValueOnce(null);
    const saved = await service.create(actor, {
      ...payload,
      materialId: ' MAT-1 ',
      name: ' 베어링 ',
      maker: '  ',
      attachmentId: ' files ',
    });
    expect(repository.findOneBy).toHaveBeenCalledWith({
      companyId: 'A',
      materialId: 'MAT-1',
    });
    expect(saved).toMatchObject({
      companyId: 'A',
      materialId: 'MAT-1',
      name: '베어링',
      baseUnit: 'EA',
      maker: null,
      attachmentId: 'files',
      deleteYn: 'N',
      createdBy: 'editor',
    });
    expect(saved).not.toHaveProperty('status');
    expect(codes.assertValidItem).toHaveBeenCalledWith({
      companyId: 'A',
      codeId: 'MATERIAL_TYPE',
      codeItemId: 'PART',
    });
  });
  it.each(['N', 'Y'])(
    'rejects duplicate codes including deleteYn=%s',
    async (deleteYn) => {
      const { service, row, repository } = fixture();
      row.deleteYn = deleteYn;
      await expect(service.create(actor, payload)).rejects.toThrow('이미 등록');
      expect(repository.save).not.toHaveBeenCalled();
    },
  );
  it('maps a database unique conflict after the precheck to a conflict response', async () => {
    const { service, repository } = fixture();
    repository.findOneBy.mockResolvedValueOnce(null);
    repository.save.mockRejectedValueOnce(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate'), { code: '23505' }),
      ),
    );
    await expect(service.create(actor, payload)).rejects.toMatchObject({
      status: 409,
    });
  });
  it('allows an authorized editor to change another creator’s master and preserves audit/attachments', async () => {
    const { service, codes } = fixture();
    const saved = await service.update(actor, 'MAT-1', {
      name: '교체 부품',
      note: ' 수정 ',
    });
    expect(saved).toMatchObject({
      name: '교체 부품',
      createdBy: 'other-owner',
      updatedBy: 'editor',
      attachmentId: 'files',
      note: '수정',
    });
    expect(saved.updatedAt).toBeInstanceOf(Date);
    expect(codes.assertValidItem).not.toHaveBeenCalled();
  });
  it('preserves a historical type when unchanged and validates a newly selected type', async () => {
    const { service, codes } = fixture();
    await service.update(actor, 'MAT-1', { typeCode: 'PART' });
    expect(codes.assertValidItem).not.toHaveBeenCalled();
    codes.assertValidItem.mockRejectedValueOnce(
      new Error('invalid type') as never,
    );
    await expect(
      service.update(actor, 'MAT-1', { typeCode: 'INVALID' }),
    ).rejects.toThrow('invalid type');
  });
  it('soft deletes without clearing attachments or changing the creator', async () => {
    const { service, repository } = fixture();
    expect(await service.remove(actor, 'MAT-1')).toMatchObject({
      deleteYn: 'Y',
      attachmentId: 'files',
      createdBy: 'other-owner',
      updatedBy: 'editor',
    });
    expect(repository.findOneBy).toHaveBeenCalledWith({
      companyId: 'A',
      materialId: 'MAT-1',
      deleteYn: 'N',
    });
  });
  it('returns not found for rows outside the authenticated company or deleted rows', async () => {
    const { service, repository } = fixture();
    repository.findOneBy.mockResolvedValue(null);
    await expect(service.findOne(actor, 'MAT-1')).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.update(actor, 'MAT-1', { note: 'x' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(service.remove(actor, 'MAT-1')).rejects.toMatchObject({
      status: 404,
    });
    expect(repository.findOneBy).toHaveBeenCalledWith({
      companyId: 'A',
      materialId: 'MAT-1',
      deleteYn: 'N',
    });
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('keeps company/deletion predicates while searching and paginating', async () => {
    const { service, builder } = fixture();
    expect(
      await service.findAll(actor, {
        page: 2,
        searchType: 'name',
        searchVal: ' bearing ',
      }),
    ).toMatchObject({ page: 2, limit: 20, total: 1 });
    expect(builder.where).toHaveBeenCalledTimes(1);
    expect(builder.where).toHaveBeenCalledWith(
      'material.companyId = :companyId',
      { companyId: 'A' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'material.deleteYn = :deleteYn',
      { deleteYn: 'N' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'material.name ILIKE :searchVal',
      { searchVal: '%bearing%' },
    );
    expect(builder.skip).toHaveBeenCalledWith(20);
  });
  it('rejects invalid search combinations and blank required master fields', async () => {
    const { service } = fixture();
    await expect(
      service.findAll(actor, { searchType: 'name' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.update(actor, 'MAT-1', { baseUnit: '  ' }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('provides material type choices from the current company', async () => {
    const { service, types } = fixture();
    expect(await service.getOptions(actor)).toEqual({
      types: [{ value: 'PART', label: '부품' }],
    });
    expect(types.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'A', codeId: 'MATERIAL_TYPE' },
      }),
    );
  });
  it('rejects immutable code, status, company and audit overrides through the update DTO', async () => {
    const errors = await validate(
      plainToInstance(UpdateMaterialDto, {
        materialId: 'NEW',
        status: 'C',
        companyId: 'B',
        createdBy: 'forged',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((e) => e.property).sort()).toEqual([
      'companyId',
      'createdBy',
      'materialId',
      'status',
    ]);
    expect(
      await validate(
        plainToInstance(CreateMaterialDto, {
          ...payload,
          materialId: 'x'.repeat(51),
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'materialId' }),
      ]),
    );
  });
});

describe('Material controller RBAC', () => {
  it('requires both JWT and permissions guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MaterialController)).toEqual([
      JwtAuthGuard,
      PermissionsGuard,
    ]);
  });
  it.each([
    ['findAll', 'read'],
    ['findOne', 'read'],
    ['getOptions', 'read'],
    ['create', 'create'],
    ['update', 'update'],
    ['remove', 'delete'],
  ] as const)('%s requires material:%s', (method, action) => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        MaterialController.prototype[method],
      ),
    ).toEqual([`material:${action}`]);
  });
});
