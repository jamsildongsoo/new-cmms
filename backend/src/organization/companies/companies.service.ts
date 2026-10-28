import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { CompanyResponseDto } from './dto/company-response.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Company } from './entities/company.entity';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async findMine(userContext: UserContext): Promise<CompanyResponseDto> {
    return this.toResponse(await this.findMineOrThrow(userContext.companyId));
  }

  async createMine(
    userContext: UserContext,
    dto: CreateCompanyDto,
  ): Promise<CompanyResponseDto> {
    const existingCompany = await this.companyRepository.findOneBy({
      companyId: userContext.companyId,
    });

    if (existingCompany) {
      throw new ConflictException('Company already exists');
    }

    const company = this.companyRepository.create({
      companyId: userContext.companyId,
      name: this.requireTrimmedString(dto.name, 'name'),
      registrationNumber: this.normalizeNullableString(dto.registrationNumber),
      note: this.normalizeNullableString(dto.note),
      deleteYn: 'N',
      createdBy: userContext.userId,
    });

    return this.toResponse(await this.companyRepository.save(company));
  }

  async updateMine(
    userContext: UserContext,
    dto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    const company = await this.findMineOrThrow(userContext.companyId);

    if (dto.name !== undefined) {
      company.name = this.requireTrimmedString(dto.name, 'name');
    }
    if (dto.registrationNumber !== undefined) {
      company.registrationNumber = this.normalizeNullableString(
        dto.registrationNumber,
      );
    }
    if (dto.note !== undefined) {
      company.note = this.normalizeNullableString(dto.note);
    }

    company.updatedBy = userContext.userId;
    company.updatedAt = new Date();

    return this.toResponse(await this.companyRepository.save(company));
  }

  async removeMine(userContext: UserContext): Promise<CompanyResponseDto> {
    const company = await this.findMineOrThrow(userContext.companyId);

    company.deleteYn = 'Y';
    company.updatedBy = userContext.userId;
    company.updatedAt = new Date();

    return this.toResponse(await this.companyRepository.save(company));
  }

  private async findMineOrThrow(companyId: string): Promise<Company> {
    const company = await this.companyRepository.findOneBy({
      companyId,
      deleteYn: 'N',
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
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

  private toResponse(company: Company): CompanyResponseDto {
    return {
      companyId: company.companyId,
      name: company.name,
      registrationNumber: company.registrationNumber,
      note: company.note,
      deleteYn: company.deleteYn,
      createdBy: company.createdBy,
      createdAt: company.createdAt,
      updatedBy: company.updatedBy,
      updatedAt: company.updatedAt,
    };
  }
}
