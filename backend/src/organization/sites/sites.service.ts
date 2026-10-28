import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { CreateSiteDto } from './dto/create-site.dto';
import { SiteResponseDto } from './dto/site-response.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { Site } from './entities/site.entity';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly siteRepository: Repository<Site>,
  ) {}

  async findAll(userContext: UserContext): Promise<SiteResponseDto[]> {
    const sites = await this.siteRepository.find({
      where: { companyId: userContext.companyId, deleteYn: 'N' },
      order: { siteId: 'ASC' },
    });
    return sites.map((site) => this.toResponse(site));
  }

  async findOne(
    userContext: UserContext,
    siteId: string,
  ): Promise<SiteResponseDto> {
    return this.toResponse(
      await this.findActiveByIdOrThrow(userContext.companyId, siteId),
    );
  }

  async create(
    userContext: UserContext,
    dto: CreateSiteDto,
  ): Promise<SiteResponseDto> {
    const siteId = this.requireTrimmedString(dto.siteId, 'siteId');
    const name = this.requireTrimmedString(dto.name, 'name');
    const existingSite = await this.siteRepository.findOneBy({
      companyId: userContext.companyId,
      siteId,
    });

    if (existingSite) {
      throw new ConflictException('Site already exists');
    }

    const site = this.siteRepository.create({
      companyId: userContext.companyId,
      siteId,
      name,
      deleteYn: 'N',
      createdBy: userContext.userId,
    });

    return this.toResponse(await this.siteRepository.save(site));
  }

  async update(
    userContext: UserContext,
    siteId: string,
    dto: UpdateSiteDto,
  ): Promise<SiteResponseDto> {
    const site = await this.findActiveByIdOrThrow(
      userContext.companyId,
      siteId,
    );

    if (dto.name !== undefined) {
      site.name = this.requireTrimmedString(dto.name, 'name');
    }
    site.updatedBy = userContext.userId;
    site.updatedAt = new Date();

    return this.toResponse(await this.siteRepository.save(site));
  }

  async remove(
    userContext: UserContext,
    siteId: string,
  ): Promise<SiteResponseDto> {
    const site = await this.findActiveByIdOrThrow(
      userContext.companyId,
      siteId,
    );
    site.deleteYn = 'Y';
    site.updatedBy = userContext.userId;
    site.updatedAt = new Date();
    return this.toResponse(await this.siteRepository.save(site));
  }

  private async findActiveByIdOrThrow(
    companyId: string,
    siteId: string,
  ): Promise<Site> {
    const site = await this.siteRepository.findOneBy({
      companyId,
      siteId: this.requireTrimmedString(siteId, 'siteId'),
      deleteYn: 'N',
    });
    if (!site) {
      throw new NotFoundException('Site not found');
    }
    return site;
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

  private toResponse(site: Site): SiteResponseDto {
    return {
      companyId: site.companyId,
      siteId: site.siteId,
      name: site.name,
      deleteYn: site.deleteYn,
      createdBy: site.createdBy,
      createdAt: site.createdAt,
      updatedBy: site.updatedBy,
      updatedAt: site.updatedAt,
    };
  }
}
