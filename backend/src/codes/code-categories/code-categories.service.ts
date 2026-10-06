import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { CodeCategoryResponseDto } from './dto/code-category-response.dto';
import { CreateCodeCategoryDto } from './dto/create-code-category.dto';
import { UpdateCodeCategoryDto } from './dto/update-code-category.dto';
import { CodeCategoryEntity } from './entities/code-category.entity';

@Injectable()
export class CodeCategoriesService {
  constructor(
    @InjectRepository(CodeCategoryEntity)
    private readonly codeCategoryRepository: Repository<CodeCategoryEntity>,
  ) {}

  async findAll(userContext: UserContext): Promise<CodeCategoryResponseDto[]> {
    const categories = await this.codeCategoryRepository.find({
      where: {
        companyId: userContext.companyId,
        deleteYn: 'N',
      },
      order: {
        module: 'ASC',
        codeId: 'ASC',
      },
    });

    return categories.map((category) => this.toResponse(category));
  }

  async findOne(
    userContext: UserContext,
    codeId: string,
  ): Promise<CodeCategoryResponseDto> {
    return this.toResponse(
      await this.findActiveByIdOrThrow(userContext.companyId, codeId),
    );
  }

  async create(
    userContext: UserContext,
    dto: CreateCodeCategoryDto,
  ): Promise<CodeCategoryResponseDto> {
    const codeId = this.requireTrimmedString(dto.codeId, 'codeId');
    const existingCategory = await this.codeCategoryRepository.findOneBy({
      companyId: userContext.companyId,
      codeId,
    });

    if (existingCategory) {
      throw new ConflictException('Code category already exists');
    }

    const category = this.codeCategoryRepository.create({
      companyId: userContext.companyId,
      codeId,
      name: this.requireTrimmedString(dto.name, 'name'),
      module: this.requireTrimmedString(dto.module, 'module'),
      deleteYn: 'N',
      createdBy: userContext.userId,
    });

    return this.toResponse(await this.codeCategoryRepository.save(category));
  }

  async update(
    userContext: UserContext,
    codeId: string,
    dto: UpdateCodeCategoryDto,
  ): Promise<CodeCategoryResponseDto> {
    const category = await this.findActiveByIdOrThrow(
      userContext.companyId,
      codeId,
    );

    if (dto.name !== undefined) {
      category.name = this.requireTrimmedString(dto.name, 'name');
    }
    if (dto.module !== undefined) {
      category.module = this.requireTrimmedString(dto.module, 'module');
    }

    category.updatedBy = userContext.userId;
    category.updatedAt = new Date();

    return this.toResponse(await this.codeCategoryRepository.save(category));
  }

  async remove(
    userContext: UserContext,
    codeId: string,
  ): Promise<CodeCategoryResponseDto> {
    const category = await this.findActiveByIdOrThrow(
      userContext.companyId,
      codeId,
    );

    category.deleteYn = 'Y';
    category.updatedBy = userContext.userId;
    category.updatedAt = new Date();

    return this.toResponse(await this.codeCategoryRepository.save(category));
  }

  async findActiveByIdOrThrow(
    companyId: string,
    codeId: string,
  ): Promise<CodeCategoryEntity> {
    const category = await this.codeCategoryRepository.findOneBy({
      companyId,
      codeId: this.requireTrimmedString(codeId, 'codeId'),
      deleteYn: 'N',
    });

    if (!category) {
      throw new NotFoundException('Code category not found');
    }

    return category;
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

  private toResponse(category: CodeCategoryEntity): CodeCategoryResponseDto {
    return {
      companyId: category.companyId,
      codeId: category.codeId,
      name: category.name,
      module: category.module,
      deleteYn: category.deleteYn,
      createdBy: category.createdBy,
      createdAt: category.createdAt,
      updatedBy: category.updatedBy,
      updatedAt: category.updatedAt,
    };
  }
}
