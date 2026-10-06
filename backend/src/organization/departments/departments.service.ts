import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { DepartmentResponseDto } from './dto/department-response.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Department } from './entities/department.entity';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async findAll(userContext: UserContext): Promise<DepartmentResponseDto[]> {
    const departments = await this.departmentRepository.find({
      where: { companyId: userContext.companyId, deleteYn: 'N' },
      order: { deptId: 'ASC' },
    });
    return departments.map((department) => this.toResponse(department));
  }

  async findOne(
    userContext: UserContext,
    deptId: string,
  ): Promise<DepartmentResponseDto> {
    return this.toResponse(
      await this.findActiveByIdOrThrow(userContext.companyId, deptId),
    );
  }

  async create(
    userContext: UserContext,
    dto: CreateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    const deptId = this.requireTrimmedString(dto.deptId, 'deptId');
    const existingDepartment = await this.departmentRepository.findOneBy({
      companyId: userContext.companyId,
      deptId,
    });

    if (existingDepartment) {
      throw new ConflictException('Department already exists');
    }

    const department = this.departmentRepository.create({
      companyId: userContext.companyId,
      deptId,
      siteId: this.normalizeNullableString(dto.siteId),
      name: this.requireTrimmedString(dto.name, 'name'),
      parentDeptId: this.normalizeParentDeptId(dto.parentDeptId, deptId),
      deleteYn: 'N',
      createdBy: userContext.userId,
    });

    return this.toResponse(await this.departmentRepository.save(department));
  }

  async update(
    userContext: UserContext,
    deptId: string,
    dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    const department = await this.findActiveByIdOrThrow(
      userContext.companyId,
      deptId,
    );

    if (dto.siteId !== undefined) {
      department.siteId = this.normalizeNullableString(dto.siteId);
    }
    if (dto.name !== undefined) {
      department.name = this.requireTrimmedString(dto.name, 'name');
    }
    if (dto.parentDeptId !== undefined) {
      department.parentDeptId = this.normalizeParentDeptId(
        dto.parentDeptId,
        department.deptId,
      );
    }

    department.updatedBy = userContext.userId;
    department.updatedAt = new Date();

    return this.toResponse(await this.departmentRepository.save(department));
  }

  async remove(
    userContext: UserContext,
    deptId: string,
  ): Promise<DepartmentResponseDto> {
    const department = await this.findActiveByIdOrThrow(
      userContext.companyId,
      deptId,
    );
    department.deleteYn = 'Y';
    department.updatedBy = userContext.userId;
    department.updatedAt = new Date();
    return this.toResponse(await this.departmentRepository.save(department));
  }

  private async findActiveByIdOrThrow(
    companyId: string,
    deptId: string,
  ): Promise<Department> {
    const department = await this.departmentRepository.findOneBy({
      companyId,
      deptId: this.requireTrimmedString(deptId, 'deptId'),
      deleteYn: 'N',
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }

  private normalizeParentDeptId(
    value: string | null | undefined,
    deptId: string,
  ): string | null {
    const parentDeptId = this.normalizeNullableString(value);
    if (parentDeptId === deptId) {
      throw new BadRequestException('parentDeptId cannot equal deptId');
    }
    return parentDeptId;
  }

  private requireTrimmedString(
    value: string | undefined,
    fieldName: string,
  ): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return value.trim();
  }

  private normalizeNullableString(
    value: string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmedValue = value.trim();
    return trimmedValue === '' ? null : trimmedValue;
  }

  private toResponse(department: Department): DepartmentResponseDto {
    return {
      companyId: department.companyId,
      deptId: department.deptId,
      siteId: department.siteId,
      name: department.name,
      parentDeptId: department.parentDeptId,
      deleteYn: department.deleteYn,
      createdBy: department.createdBy,
      createdAt: department.createdAt,
      updatedBy: department.updatedBy,
      updatedAt: department.updatedAt,
    };
  }
}
