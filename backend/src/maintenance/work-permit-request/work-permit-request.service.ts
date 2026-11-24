import { applyTypedSearch } from '../../common/utils/typed-search.util';
import { SearchPermitDto } from '../work-permit/dto/search-permit.dto';
import { normalizePaginationQuery } from '../../common/utils/pagination.util';
import { ForbiddenException } from '@nestjs/common';
import { DocumentStatus } from '../../common/constants/document-status';
import type { EntityManager } from 'typeorm';
/** 허가요청은 작성자 초안에서 신청 완료로 확정하며 전자결재와 분리한다. */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from '../../organization/sites/entities/site.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { UserContext } from '../../auth/types/user-context.type';
import {
  permitOwner,
  validatePermitData,
} from '../work-permit/permit-validation';
import { WorkPermitRequest } from './entities/work-permit-request.entity';
import {
  CreatePermitRequestDto,
  SavePermitRequestDto,
} from './dto/work-permit-request.dto';
@Injectable()
export class WorkPermitRequestService {
  async options(user: UserContext) {
    this.query(user);
    const [sites, departments] = await Promise.all([
      this.repository.manager.getRepository(Site).find({ where: { companyId: user.companyId, deleteYn: 'N' } }),
      this.repository.manager.getRepository(Department).find({ where: { companyId: user.companyId, deleteYn: 'N' } }),
    ]);
    return {
      sites: sites.map(({ siteId, name }) => ({ value: siteId, label: name })),
      departments: departments.map(({ deptId, name }) => ({ value: deptId, label: name })),
    };
  }
  withManager(manager: EntityManager): WorkPermitRequestService {
    return new WorkPermitRequestService(
      manager.getRepository(WorkPermitRequest),
    );
  }

  constructor(
    @InjectRepository(WorkPermitRequest)
    private readonly repository: Repository<WorkPermitRequest>,
  ) {}
  private query(user: UserContext) {
    // 이 모듈의 조회 정책이다. 기본 조건 뒤에는 andWhere로 업무 조건을 추가한다.
    const query = this.repository.createQueryBuilder('r');
    query
      .where('r.companyId = :companyId', { companyId: user.companyId })
      .andWhere('r.deleteYn = :deleteYn', { deleteYn: 'N' });
    if (user.accessScope === 'COMPANY_ALL') return query;
    if (user.accessScope === 'OWN_SITE' && user.siteId)
      return query.andWhere('r.siteId = :scopeSiteId', {
        scopeSiteId: user.siteId,
      });
    if (user.accessScope === 'OWN_DEPARTMENT' && user.deptId)
      return query.andWhere(
        `r.deptId IN (
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
  async findAll(user: UserContext, filter: SearchPermitDto = {}) {
    const { page, limit, offset } = normalizePaginationQuery(filter);
    const query = this.query(user).select([
      'r.workPermitRequestId',
      'r.documentNo',
      'r.data',
      'r.status',
    ]);
    // 설비번호는 직접 입력 참고값이다. 검색 대상은 문서번호·관리번호·작업명만 둔다.
    applyTypedSearch(query, filter.search, filter.searchType, { id: 'r.workPermitRequestId', documentNo: 'r.documentNo', title: "r.data->>'title'", createdBy: 'r.createdBy' }, ['r.workPermitRequestId', 'r.documentNo', "r.data->>'title'"]);
    const [rows, total] = await query
      .orderBy('r.createdAt', 'DESC')
      .addOrderBy('r.workPermitRequestId', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return {
      items: rows.map((row) => ({
        workPermitRequestId: row.workPermitRequestId,
        documentNo: row.documentNo,
        title: row.data.title,
        applicantName: row.data.applicantName,
        status: row.status,
      })),
      total,
      page,
      limit,
    };
  }
  async findOne(user: UserContext, id: string) {
    const row = await this.query(user)
      .andWhere('r.workPermitRequestId = :id', { id })
      .getOne();
    if (!row) throw new NotFoundException('허가 요청서가 없습니다.');
    return row;
  }
  async create(user: UserContext, dto: CreatePermitRequestDto) {
    validatePermitData(dto.data);
    if (
      await this.repository.findOneBy({
        companyId: user.companyId,
        workPermitRequestId: dto.workPermitRequestId,
      })
    )
      throw new ConflictException('이미 존재합니다.');
    return this.repository.save(
      this.repository.create({
        companyId: user.companyId,
        workPermitRequestId: dto.workPermitRequestId,
        documentNo: dto.documentNo?.trim() ?? '',
        data: dto.data,
        attachmentId: dto.attachmentId ?? null,
        siteId: user.siteId ?? null,
        deptId: user.deptId || null,
        status: DocumentStatus.DRAFT,
        deleteYn: 'N',
        createdBy: user.userId,
      }),
    );
  }
  async update(user: UserContext, id: string, dto: SavePermitRequestDto) {
    const row = await this.findOne(user, id);
    permitOwner(user, row);
    validatePermitData(dto.data);
    Object.assign(row, {
      documentNo: dto.documentNo?.trim() ?? '',
      data: dto.data,
      attachmentId: dto.attachmentId ?? null,
      updatedBy: user.userId,
      updatedAt: new Date(),
    });
    return this.repository.save(row);
  }
  async remove(user: UserContext, id: string) {
    const row = await this.findOne(user, id);
    permitOwner(user, row);
    row.deleteYn = 'Y';
    row.updatedBy = user.userId;
    row.updatedAt = new Date();
    return this.repository.save(row);
  }
  async submit(user: UserContext, id: string) {
    const row = await this.findOne(user, id);
    permitOwner(user, row);
    validatePermitData(row.data);
    // 신청 자체가 요청 내용의 확정이다. 작업허가서의 발행·결재와 분리한다.
    row.status = DocumentStatus.CONFIRMED;
    row.updatedBy = user.userId;
    row.updatedAt = new Date();
    return this.repository.save(row);
  }
}
