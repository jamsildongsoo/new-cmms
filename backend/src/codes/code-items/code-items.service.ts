import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { isCode } from '../../common/constants/code';
import { CodeItemResponseDto } from './dto/code-item-response.dto';
import { CreateCodeItemDto } from './dto/create-code-item.dto';
import { UpdateCodeItemDto } from './dto/update-code-item.dto';
import { CodeItem } from './entities/code-item.entity';

@Injectable()
export class CodeItemsService {
  constructor(
    @InjectRepository(CodeItem)
    private readonly codeItemRepository: Repository<CodeItem>,
  ) {}

  async findByCode(
    userContext: UserContext,
    codeId: string,
  ): Promise<CodeItemResponseDto[]> {
    return this.findActiveItems(
      userContext.companyId,
      this.assertKnownCode(codeId),
    );
  }

  async findOne(
    userContext: UserContext,
    codeId: string,
    codeItemId: string,
  ): Promise<CodeItemResponseDto> {
    const item = await this.findActiveByIdOrThrow(
      userContext.companyId,
      codeId,
      codeItemId,
    );
    return this.toResponse(item);
  }

  async create(
    userContext: UserContext,
    dto: CreateCodeItemDto,
  ): Promise<CodeItemResponseDto> {
    const normalizedCodeId = this.assertKnownCode(dto.codeId);
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
      codeId: this.assertKnownCode(codeId),
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

  private assertKnownCode(codeId: string | undefined): string {
    const normalized = this.requireTrimmedString(codeId, 'codeId');
    if (!isCode(normalized)) {
      throw new NotFoundException('Code not found');
    }
    return normalized;
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
