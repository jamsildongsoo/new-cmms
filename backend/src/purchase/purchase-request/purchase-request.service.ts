import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
/** 구매요청의 품목·수량과 결재 상태를 관리한다. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { applyDocumentScope } from '../../common/utils/document-scope.util';
import { businessDate } from '../../common/utils/posting-date';
import { decimal, qty } from '../../common/utils/stock-decimal';
import { DocumentStatus } from '../../common/constants/document-status';
import { CodeItem } from '../../codes/code-items/entities/code-item.entity';
import { Material } from '../../inventory/material/entities/material.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { User } from '../../identity/users/entities/user.entity';
import { PurchaseRequest } from '../purchase-request/entities/purchase-request.entity';
import { PurchaseRequestItem } from '../purchase-request/entities/purchase-request-item.entity';
import { PurchaseRequestSaveDto } from './dto/purchase-request.dto';
import { PurchaseSearchDto } from '../common/purchase-search.dto';
type Header = PurchaseRequest;
type Item = PurchaseRequestItem;
@Injectable()
export class PurchaseRequestService {
  constructor(private readonly db: DataSource) {}
  create(user: UserContext, dto: CreatePurchaseRequestDto) {
    return this.save(user, dto.requestId, dto, true);
  }
  update(user: UserContext, id: string, dto: PurchaseRequestSaveDto) {
    return this.save(user, id, dto, false);
  }
  private headers(manager = this.db.manager) {
    return manager.getRepository<Header>(PurchaseRequest);
  }
  private items(manager = this.db.manager) {
    return manager.getRepository(PurchaseRequestItem);
  }
  private scoped(user: UserContext, manager = this.db.manager) {
    const query = this.headers(manager).createQueryBuilder('p');

    return applyDocumentScope(query, user, 'p');
  }
  async findAll(user: UserContext, filter: PurchaseSearchDto = {}) {
    const q = this.scoped(user).orderBy('p.createdAt', 'DESC');
    if (filter.status)
      q.andWhere('p.status = :status', { status: filter.status });
    if (filter.search?.trim())
      q.andWhere(
        `(p.title ILIKE :search OR p.documentNo ILIKE :search OR p.requestId ILIKE :search)`,
        {
          search: `%${filter.search.trim()}%`,
        },
      );
    const date = 'requestDate';
    if (filter.from)
      q.andWhere(`p.${date} >= :from`, { from: businessDate(filter.from) });
    if (filter.to)
      q.andWhere(`p.${date} <= :to`, { to: businessDate(filter.to) });
    return q.getMany();
  }
  async findOne(user: UserContext, id: string, manager = this.db.manager) {
    const row = await this.scoped(user, manager)
      .andWhere(`p.requestId = :id`, { id })
      .getOne();
    if (!row)
      throw new NotFoundException('구매 문서가 없거나 조회 범위 밖입니다.');
    const items = await this.items(manager).find({
      where: { companyId: user.companyId, requestId: id },
      order: { sortOrder: 'ASC' },
    });
    return Object.assign({}, row, { items });
  }
  private editable(user: UserContext, row: Header) {
    if (row.status !== 'D' || row.createdBy !== user.userId)
      throw new ForbiddenException('작성자만 초안을 처리할 수 있습니다.');
  }
  private text(value: unknown, label: string) {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException(`${label}을 입력하십시오.`);
    return value.trim();
  }
  async options(user: UserContext) {
    this.scoped(user);
    const companyId = user.companyId;
    const [materials, sites, departments, users, types] = await Promise.all([
      this.db.getRepository(Material).find({
        where: { companyId, deleteYn: 'N' },
        order: { materialId: 'ASC' },
      }),
      this.db.getRepository(Site).find({ where: { companyId, deleteYn: 'N' } }),
      this.db
        .getRepository(Department)
        .find({ where: { companyId, deleteYn: 'N' } }),
      this.db.getRepository(User).find({ where: { companyId, deleteYn: 'N' } }),
      this.db.getRepository(CodeItem).find({
        where: { companyId, codeId: 'PURCHASE_REQUEST_TYPE' },
        order: { sortOrder: 'ASC' },
      }),
    ]);
    const options = {
      materials: materials.map(({ materialId, name, spec, baseUnit }) => ({
        materialId,
        name,
        spec,
        baseUnit,
      })),
      sites: sites.map((r) => ({ value: r.siteId, label: r.name })),
      departments: departments.map((r) => ({ value: r.deptId, label: r.name })),
      users: users.map((r) => ({ value: r.userId, label: r.name })),
      types: types.map((r) => ({ value: r.codeItemId, label: r.name })),
    };
    return options;
  }
  async save(
    user: UserContext,
    id: string,
    dto: PurchaseRequestSaveDto,
    create: boolean,
  ) {
    await this.db.transaction(async (manager) => {
      let old: Awaited<ReturnType<PurchaseRequestService['findOne']>> | null =
        null;
      if (!create) {
        old = await this.findOne(user, id, manager);
        this.editable(user, old);
      } else if (
        await this.headers(manager).findOneBy({
          companyId: user.companyId,
          requestId: id,
        })
      )
        throw new ConflictException('이미 존재하는 문서입니다.');
      const siteId = dto.siteId ?? old?.siteId ?? user.siteId,
        deptId = dto.deptId ?? old?.deptId ?? user.deptId;
      // 새 소속이 OWN_SITE/부서 scope 밖인지 문서와 동일한 조건으로 검사한다.
      if (user.accessScope === 'OWN_SITE' && siteId !== user.siteId)
        throw new ForbiddenException('사업장 범위 밖입니다.');
      if (user.accessScope === 'OWN_DEPARTMENT') {
        const allowed = await manager
          .getRepository(Department)
          .createQueryBuilder('d')
          .where('d.companyId=:companyId', { companyId: user.companyId })
          .andWhere(
            `d.deptId IN (WITH RECURSIVE ds AS (SELECT "deptId" FROM department WHERE "companyId"=:companyId AND "deptId"=:deptId AND "deleteYn"='N' UNION SELECT d."deptId" FROM department d JOIN ds ON d."parentDeptId"=ds."deptId" WHERE d."companyId"=:companyId AND d."deleteYn"='N') SELECT "deptId" FROM ds)`,
            { deptId: user.deptId },
          )
          .getMany();
        if (!allowed.some((d) => d.deptId === deptId))
          throw new ForbiddenException('부서 범위 밖입니다.');
      }
      this.scoped(user, manager);
      if (
        dto.typeCode &&
        (!old || dto.typeCode !== old.typeCode) &&
        !(await manager.getRepository(CodeItem).findOneBy({
          companyId: user.companyId,
          codeId: 'PURCHASE_REQUEST_TYPE',
          codeItemId: dto.typeCode,
        }))
      )
        throw new BadRequestException('유형 코드가 없습니다.');
      const seen = new Set<string>(),
        items: Item[] = [];
      for (const [index, input] of dto.items.entries()) {
        const itemId = input.itemId ?? randomUUID();
        if (seen.has(itemId))
          throw new BadRequestException('품목 ID가 중복됩니다.');
        seen.add(itemId);
        const quantity = decimal(qty(input.quantity));
        if (qty(quantity) <= 0n)
          throw new BadRequestException('수량은 양수여야 합니다.');
        const oldItem = old?.items.find(
          (i) => i.itemId === itemId && i.materialId === input.materialId,
        );
        const material = await manager.getRepository(Material).findOneBy({
          companyId: user.companyId,
          materialId: input.materialId,
          ...(oldItem ? {} : { deleteYn: 'N' }),
        });
        if (!material)
          throw new BadRequestException('같은 회사의 자재를 선택하십시오.');
        const snapshot = oldItem;
        if ('unitPrice' in input && input.unitPrice != null)
          throw new BadRequestException(
            '구매요청에는 단가를 입력하지 않습니다. 비교 견적은 첨부하십시오.',
          );
        const item: Item = {
          companyId: user.companyId,
          requestId: id,
          itemId,
          sortOrder: index,
          materialId: input.materialId,
          materialName: snapshot?.materialName ?? material.name,
          spec: snapshot?.spec ?? material.spec,
          baseUnit: snapshot?.baseUnit ?? material.baseUnit,
          quantity,

          note: input.note?.trim() || null,
        };
        items.push(item);
      }
      const data: Partial<Header> = {
        companyId: user.companyId,
        requestId: id,
        documentNo: dto.documentNo?.trim() ?? '',
        title: this.text(dto.title, '제목'),
        siteId,
        deptId,
        requesterId: dto.requesterId ?? old?.requesterId ?? user.userId,
        typeCode: dto.typeCode?.trim() || null,
        content: dto.content?.trim() || null,
        note: dto.note?.trim() || null,
        attachmentId: dto.attachmentId?.trim() || null,
        status: old?.status ?? 'D',
        createdBy: old?.createdBy ?? user.userId,
        deleteYn: 'N',
      };
      Object.assign(data, {
        requestDate: businessDate(dto.requestDate, true),
        requiredDate: businessDate(dto.requiredDate, true),
      });
      if (old) {
        data.updatedBy = user.userId;
        data.updatedAt = new Date();
      }
      await this.headers(manager).save(
        Object.assign(this.headers(manager).create(), old ?? {}, data),
      );
      await this.items(manager).delete({
        companyId: user.companyId,
        requestId: id,
      });
      if (items.length) await this.items(manager).save(items);
    });
    return this.findOne(user, id);
  }
  async assertCanSubmit(user: UserContext, id: string) {
    const row = await this.findOne(user, id);
    this.editable(user, row);
    if (!row.items.length)
      throw new BadRequestException('품목을 입력하십시오.');
    businessDate(row.requestDate);

    for (const item of row.items) {
      const material = await this.db.getRepository(Material).findOneBy({
        companyId: user.companyId,
        materialId: item.materialId,
        deleteYn: 'N',
      });
      if (!material || material.baseUnit !== item.baseUnit)
        throw new BadRequestException('삭제되었거나 단위가 변경된 자재입니다.');
    }
  }
  async remove(user: UserContext, id: string) {
    const row = await this.findOne(user, id);
    this.editable(user, row);
    await this.headers().update(
      { companyId: user.companyId, requestId: id },
      { deleteYn: 'Y', updatedBy: user.userId, updatedAt: new Date() },
    );
    return row;
  }
  async syncApprovalStatus(
    companyId: string,
    id: string,
    status: DocumentStatus,
    updatedBy: string,
  ) {
    const row = await this.headers().findOneBy({
      companyId,
      requestId: id,
      deleteYn: 'N',
    });
    if (!row) throw new NotFoundException('구매 문서가 없습니다.');
    if (row.status === status) return;
    if (
      (status === 'P' && row.status !== 'D') ||
      (status !== 'P' && row.status !== 'P')
    )
      throw new ConflictException('구매 문서 상태가 변경되었습니다.');
    await this.headers().update(
      { companyId, requestId: id },
      { status, updatedBy, updatedAt: new Date() },
    );
  }
}
