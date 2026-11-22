import { inputQuantity } from '../../common/utils/decimal.util';
import { normalizePaginationQuery } from '../../common/utils/pagination.util';
import { CodeGroup } from '../../common/constants/code';
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
import { DataSource, EntityManager } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { businessDate } from '../../common/utils/date.util';
import { decimal, qty } from '../../common/utils/decimal.util';
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
  private transactionManager?: EntityManager;
  withManager(manager: EntityManager): PurchaseRequestService {
    const scoped = new PurchaseRequestService(this.db);
    scoped.transactionManager = manager;
    return scoped;
  }

  constructor(private readonly db: DataSource) {}
  create(user: UserContext, dto: CreatePurchaseRequestDto) {
    return this.save(user, dto.requestId, dto, true);
  }
  update(user: UserContext, id: string, dto: PurchaseRequestSaveDto) {
    return this.save(user, id, dto, false);
  }
  private headers(manager = this.transactionManager ?? this.db.manager) {
    return manager.getRepository<Header>(PurchaseRequest);
  }
  private items(manager = this.transactionManager ?? this.db.manager) {
    return manager.getRepository(PurchaseRequestItem);
  }
  private scoped(
    user: UserContext,
    manager = this.transactionManager ?? this.db.manager,
  ) {
    // 이 모듈의 조회 정책이다. 기본 조건 뒤에는 andWhere로 업무 조건을 추가한다.
    const query = this.headers(manager).createQueryBuilder('p');
    query
      .where('p.companyId = :companyId', { companyId: user.companyId })
      .andWhere('p.deleteYn = :deleteYn', { deleteYn: 'N' });
    if (user.accessScope === 'COMPANY_ALL') return query;
    if (user.accessScope === 'OWN_SITE' && user.siteId)
      return query.andWhere('p.siteId = :scopeSiteId', {
        scopeSiteId: user.siteId,
      });
    if (user.accessScope === 'OWN_DEPARTMENT' && user.deptId)
      return query.andWhere(
        `p.deptId IN (
        WITH RECURSIVE scope_departments AS (
          SELECT "deptId" FROM "department" WHERE "companyId" = :companyId AND "deptId" = :scopeDeptId AND "deleteYn" = 'N'
          UNION
          SELECT d."deptId" FROM "department" d JOIN scope_departments p ON d."parentDeptId" = p."deptId"
          WHERE d."companyId" = :companyId AND d."deleteYn" = 'N'
        ) SELECT "deptId" FROM scope_departments
      )`,
        { scopeDeptId: user.deptId },
      );
    throw new ForbiddenException(
      'Document access scope or affiliation is missing',
    );
  }
  async findAll(user: UserContext, filter: PurchaseSearchDto = {}) {
    const { page, limit, offset } = normalizePaginationQuery(filter);
    const q = this.scoped(user)
      .select([
        'p.requestId',
        'p.documentNo',
        'p.title',
        'p.requestDate',
        'p.status',
      ])
      .orderBy('p.createdAt', 'DESC')
      .addOrderBy('p.requestId', 'DESC');
    if (filter.search?.trim())
      q.andWhere(
        '(p.title ILIKE :search OR p.documentNo ILIKE :search OR p.requestId ILIKE :search)',
        { search: `%${filter.search.trim().replace(/[\\%_]/g, '\\$&')}%` },
      );
    const [items, total] = await q.skip(offset).take(limit).getManyAndCount();
    return {
      items: items.map(
        ({ requestId, documentNo, title, requestDate, status }) => ({
          requestId,
          documentNo,
          title,
          requestDate,
          status,
        }),
      ),
      total,
      page,
      limit,
    };
  }
  // 작성 화면의 선택 목록은 일반 목록의 페이지네이션과 분리한다.
  async listForReference(user: UserContext) {
    return this.scoped(user)
      .select(['p.requestId', 'p.documentNo', 'p.title'])
      .andWhere('p.status = :status', { status: DocumentStatus.CONFIRMED })
      .orderBy('p.createdAt', 'DESC')
      .addOrderBy('p.requestId', 'DESC')
      .getMany();
  }
  async findOne(
    user: UserContext,
    id: string,
    manager = this.transactionManager ?? this.db.manager,
  ) {
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
    if (row.status !== DocumentStatus.DRAFT || row.createdBy !== user.userId)
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
      (this.transactionManager ?? this.db).getRepository(Material).find({
        where: { companyId, deleteYn: 'N' },
        order: { materialId: 'ASC' },
      }),
      (this.transactionManager ?? this.db)
        .getRepository(Site)
        .find({ where: { companyId, deleteYn: 'N' } }),
      this.db
        .getRepository(Department)
        .find({ where: { companyId, deleteYn: 'N' } }),
      (this.transactionManager ?? this.db)
        .getRepository(User)
        .find({ where: { companyId, deleteYn: 'N' } }),
      (this.transactionManager ?? this.db).getRepository(CodeItem).find({
        where: { companyId, codeId: CodeGroup.PURREQ_TYPE },
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
  /** 작성자 초안 수정 여부를 먼저 검사하고 헤더·품목을 한 트랜잭션에서 저장한다. 요청에는 금액을 계산하지 않는다. */
  async save(
    user: UserContext,
    id: string,
    dto: PurchaseRequestSaveDto,
    create: boolean,
  ) {
    await (this.transactionManager ?? this.db).transaction(async (manager) => {
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
      if (
        dto.typeCode &&
        (!old || dto.typeCode !== old.typeCode) &&
        !(await manager.getRepository(CodeItem).findOneBy({
          companyId: user.companyId,
          codeId: CodeGroup.PURREQ_TYPE,
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
        inputQuantity(input.quantity, false, oldItem?.quantity);
        const material = await manager.getRepository(Material).findOneBy({
          companyId: user.companyId,
          materialId: input.materialId,
          ...(oldItem ? {} : { deleteYn: 'N' }),
        });
        if (!material)
          throw new BadRequestException('같은 회사의 자재를 선택하십시오.');
        const item: Item = {
          companyId: user.companyId,
          requestId: id,
          itemId,
          sortOrder: index,
          materialId: input.materialId,
          materialName: oldItem?.materialName ?? material.name,
          spec: oldItem?.spec ?? material.spec,
          baseUnit: oldItem?.baseUnit ?? material.baseUnit,
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
        status: old?.status ?? DocumentStatus.DRAFT,
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
    // 대상 접근 검사는 수정 전에 수행한다. 저장 응답은 입력 소속으로 재검사하지 않는다.
    const saved = await this.headers().findOneByOrFail({
      companyId: user.companyId,
      requestId: id,
    });
    const savedItems = await this.items().find({
      where: { companyId: user.companyId, requestId: id },
      order: { sortOrder: 'ASC' },
    });
    return Object.assign({}, saved, { items: savedItems });
  }
  async assertCanSubmit(user: UserContext, id: string) {
    const row = await this.findOne(user, id);
    this.editable(user, row);
    if (!row.items.length)
      throw new BadRequestException('품목을 입력하십시오.');
    businessDate(row.requestDate);

    for (const item of row.items) {
      const material = await (this.transactionManager ?? this.db)
        .getRepository(Material)
        .findOneBy({
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
    return { success: true };
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
      (status === 'P' && row.status !== DocumentStatus.DRAFT) ||
      (status !== 'P' && row.status !== DocumentStatus.PROGRESS)
    )
      throw new ConflictException('구매 문서 상태가 변경되었습니다.');
    await this.headers().update(
      { companyId, requestId: id },
      { status, updatedBy, updatedAt: new Date() },
    );
  }
}
