import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { CodeCategoriesService } from '../code-categories/code-categories.service';
import { CodeItemResponseDto } from './dto/code-item-response.dto';
import { CreateCodeItemDto } from './dto/create-code-item.dto';
import { UpdateCodeItemDto } from './dto/update-code-item.dto';
import { CodeItem } from './entities/code-item.entity';

@Injectable()
export class CodeItemsService {
  constructor(
    @InjectRepository(CodeItem)
    private readonly codeItemRepository: Repository<CodeItem>,
    private readonly codeCategoriesService: CodeCategoriesService,
  ) {}

  async findByCategory(
    userContext: UserContext,
    codeId: string,
  ): Promise<CodeItemResponseDto[]> {
    await this.codeCategoriesService.findActiveByIdOrThrow(
      userContext.companyId,
      codeId,
    );

    return this.findActiveItems(userContext.companyId, codeId);
  }

  async findLookup(
    userContext: UserContext,
    query: { module?: string; codeId?: string },
  ): Promise<Record<string, CodeItemResponseDto[]> | CodeItemResponseDto[]> {
    const module = this.normalizeOptionalString(query.module);
    const codeId = this.normalizeOptionalString(query.codeId);

    if (codeId) {
      const category = await this.codeCategoriesService.findActiveByIdOrThrow(
        userContext.companyId,
        codeId,
      );
      if (module && category.module !== module) {
        throw new BadRequestException('codeId does not belong to module');
      }
      return this.findActiveItems(userContext.companyId, codeId);
    }

    if (!module) {
      throw new BadRequestException('module or codeId is required');
    }

    const categories = await this.codeCategoriesService.findAll(userContext);
    const moduleCategories = categories.filter(
      (category) => category.module === module,
    );
    const result: Record<string, CodeItemResponseDto[]> = {};

    for (const category of moduleCategories) {
      result[category.codeId] = await this.findActiveItems(
        userContext.companyId,
        category.codeId,
      );
    }

    return result;
  }

  async create(
    userContext: UserContext,
    codeId: string,
    dto: CreateCodeItemDto,
  ): Promise<CodeItemResponseDto> {
    await this.codeCategoriesService.findActiveByIdOrThrow(
      userContext.companyId,
      codeId,
    );

    const normalizedCodeId = this.requireTrimmedString(codeId, 'codeId');
    const codeItemId = this.requireTrimmedString(dto.codeItemId, 'codeItemId');
    const existingItem = await this.codeItemRepository.findOneBy({
      companyId: userContext.companyId,
      codeId: normalizedCodeId,
      codeItemId,
    });

    if (existingItem) {
      throw new ConflictException('Code item already exists');
    }

    const item = this.codeItemRepository.create({
      companyId: userContext.companyId,
      codeId: normalizedCodeId,
      codeItemId,
      name: this.requireTrimmedString(dto.name, 'name'),
      sortOrder: this.normalizeSortOrder(dto.sortOrder),
    });

    return this.toResponse(await this.codeItemRepository.save(item));
  }

  async update(
    userContext: UserContext,
    codeId: string,
    codeItemId: string,
    dto: UpdateCodeItemDto,
  ): Promise<CodeItemResponseDto> {
    const item = await this.findActiveByIdOrThrow(
      userContext.companyId,
      codeId,
      codeItemId,
    );

    if (dto.name !== undefined) {
      item.name = this.requireTrimmedString(dto.name, 'name');
    }
    if (dto.sortOrder !== undefined) {
      item.sortOrder = this.normalizeSortOrder(dto.sortOrder);
    }

    return this.toResponse(await this.codeItemRepository.save(item));
  }

  async remove(
    userContext: UserContext,
    codeId: string,
    codeItemId: string,
  ): Promise<CodeItemResponseDto> {
    const item = await this.findActiveByIdOrThrow(
      userContext.companyId,
      codeId,
      codeItemId,
    );

    await this.codeItemRepository.remove(item);

    return this.toResponse(item);
  }

  async findActiveByIdOrThrow(
    companyId: string,
    codeId: string,
    codeItemId: string,
  ): Promise<CodeItem> {
    const item = await this.codeItemRepository.findOneBy({
      companyId,
      codeId: this.requireTrimmedString(codeId, 'codeId'),
      codeItemId: this.requireTrimmedString(codeItemId, 'codeItemId'),
    });

    if (!item) {
      throw new NotFoundException('Code item not found');
    }

    return item;
  }

  private async findActiveItems(
    companyId: string,
    codeId: string,
  ): Promise<CodeItemResponseDto[]> {
    const items = await this.codeItemRepository.find({
      where: {
        companyId,
        codeId,
      },
      order: {
        sortOrder: 'ASC',
        codeItemId: 'ASC',
      },
    });

    return items.map((item) => this.toResponse(item));
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

  private normalizeOptionalString(
    value: string | undefined,
  ): string | undefined {
    if (value === undefined || value.trim() === '') {
      return undefined;
    }
    return value.trim();
  }

  private normalizeSortOrder(value: number | undefined): number {
    if (value === undefined) {
      return 0;
    }
    if (!Number.isInteger(value)) {
      throw new BadRequestException('sortOrder must be an integer');
    }
    return value;
  }

  private toResponse(item: CodeItem): CodeItemResponseDto {
    return {
      companyId: item.companyId,
      codeId: item.codeId,
      codeItemId: item.codeItemId,
      name: item.name,
      sortOrder: item.sortOrder,
    };
  }
}
