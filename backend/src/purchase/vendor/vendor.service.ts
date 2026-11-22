import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { normalizePaginationQuery } from '../../common/utils/pagination.util';
import { Vendor } from './entities/vendor.entity';
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import {
  CreateVendorDto,
  UpdateVendorDto,
  SearchVendorDto,
} from './dto/vendor.dto';
const optionalFields = [
  'registrationNumber',
  'representativeName',
  'contactName',
  'phoneNumber',
  'email',
  'address',
  'note',
] as const;
@Injectable()
export class VendorService {
  constructor(
    @InjectRepository(Vendor) private readonly repo: Repository<Vendor>,
  ) {}
  private required(value: unknown, label: string) {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException(`${label}을 입력하십시오.`);
    return value.trim();
  }
  private assign(row: Vendor, dto: UpdateVendorDto) {
    if (dto.name !== undefined) row.name = this.required(dto.name, '거래처명');
    for (const key of optionalFields)
      if (dto[key] !== undefined) row[key] = dto[key]?.trim() || null;
    return row;
  }
  async list(user: UserContext, dto: SearchVendorDto = {}) {
    const page = normalizePaginationQuery(dto);
    const query = this.repo
      .createQueryBuilder('v')
      .where('v.companyId=:companyId', { companyId: user.companyId })
      .andWhere("v.deleteYn='N'");
    if (dto.search?.trim())
      query.andWhere(
        '(v.vendorId ILIKE :value OR v.name ILIKE :value OR v.registrationNumber ILIKE :value)',
        { value: `%${dto.search.trim().replace(/[\\%_]/g, '\\$&')}%` },
      );
    const [items, total] = await query
      .orderBy('v.vendorId', 'ASC')
      .skip(page.offset)
      .take(page.limit)
      .getManyAndCount();
    return { items, total, page: page.page, limit: page.limit };
  }
  async get(user: UserContext, vendorId: string) {
    const row = await this.repo.findOneBy({
      companyId: user.companyId,
      vendorId,
      deleteYn: 'N',
    });
    if (!row) throw new NotFoundException('거래처를 찾을 수 없습니다.');
    return row;
  }
  async create(user: UserContext, dto: CreateVendorDto) {
    const vendorId = this.required(dto.vendorId, '거래처번호');
    if (await this.repo.findOneBy({ companyId: user.companyId, vendorId }))
      throw new ConflictException('이미 등록된 거래처번호입니다.');
    const row = this.repo.create({
      companyId: user.companyId,
      vendorId,
      name: this.required(dto.name, '거래처명'),
      deleteYn: 'N',
      createdBy: user.userId,
    });
    this.assign(row, dto);
    try {
      return await this.repo.save(row);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      )
        throw new ConflictException('이미 등록된 거래처번호입니다.');
      throw error;
    }
  }
  async update(user: UserContext, id: string, dto: UpdateVendorDto) {
    const row = this.assign(await this.get(user, id), dto);
    row.updatedBy = user.userId;
    row.updatedAt = new Date();
    return this.repo.save(row);
  }
  async deletionInfo(user: UserContext, id: string) {
    await this.get(user, id);
    const purchaseOrderCount = await this.repo.manager
      .getRepository(PurchaseOrder)
      .countBy({
        companyId: user.companyId,
        vendorId: id,
        deleteYn: 'N',
      });
    return { purchaseOrderCount };
  }
  async remove(user: UserContext, id: string) {
    const row = await this.get(user, id);
    const { purchaseOrderCount } = await this.deletionInfo(user, id);
    // 기존 발주의 거래처 참조를 유지하여 삭제 후에도 업체 정보를 조회한다.
    row.deleteYn = 'Y';
    row.updatedBy = user.userId;
    row.updatedAt = new Date();
    const saved = await this.repo.save(row);
    return Object.assign({}, saved, { purchaseOrderCount });
  }
}
