/** 허가요청은 작성자 초안에서 신청 완료로 확정하며 전자결재와 분리한다. */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { applyDocumentScope } from '../../common/utils/document-scope.util';
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
  constructor(
    @InjectRepository(WorkPermitRequest)
    private readonly repository: Repository<WorkPermitRequest>,
  ) {}
  private query(user: UserContext) {
    return applyDocumentScope(
      this.repository.createQueryBuilder('r'),
      user,
      'r',
    );
  }
  findAll(user: UserContext) {
    return this.query(user).orderBy('r.createdAt', 'DESC').getMany();
  }
  async findOne(user: UserContext, id: string) {
    const row = await this.query(user)
      .andWhere('r.workPermitRequestId = :id', { id })
      .getOne();
    if (!row) throw new NotFoundException('허가 요청서가 없습니다.');
    return row;
  }
  async create(user: UserContext, dto: CreatePermitRequestDto) {
    this.query(user);
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
        status: 'D',
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
    row.status = 'C';
    row.updatedBy = user.userId;
    row.updatedAt = new Date();
    return this.repository.save(row);
  }
}
