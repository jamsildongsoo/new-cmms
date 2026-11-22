import { normalizePaginationQuery } from '../common/utils/pagination.util';
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { LoginHistory } from './entities/login-history.entity';
import { LoginHistoryQueryDto } from './dto/login-history-query.dto';
import { UserContext } from './types/user-context.type';

export interface LoginClientInfo {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class LoginHistoryService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private readonly logger = new Logger(LoginHistoryService.name);
  constructor(
    @InjectRepository(LoginHistory)
    private readonly repository: Repository<LoginHistory>,
    private readonly config: ConfigService,
  ) {}

  async prune() {
    const days = this.config.getOrThrow<number>(
      'app.loginHistoryRetentionDays',
    );
    if (days === 0) return;
    await this.repository.delete({
      attemptedAt: LessThan(new Date(Date.now() - days * 86400000)),
    });
  }
  async onModuleInit() {
    await this.prune();
    this.timer = setInterval(() => {
      void this.prune().catch(() =>
        this.logger.error('로그인 이력 보관기간 정리에 실패했습니다.'),
      );
    }, 86400000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async record(
    companyId: string,
    userId: string,
    success: boolean,
    failureReason: string | null,
    client: LoginClientInfo,
  ) {
    // 입력한 비밀번호·토큰·전체 요청은 저장하지 않는다.
    await this.repository.insert({
      companyId,
      userId,
      success,
      failureReason,
      ipAddress: client.ipAddress?.slice(0, 64) || null,
      userAgent: client.userAgent?.slice(0, 512) || null,
    });
  }

  async list(user: UserContext, query: LoginHistoryQueryDto) {
    // 날짜만 입력하면 한국 시간 기준 해당 일 전체를 조회한다.
    const boundary = (value: string, end: boolean) =>
      new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? `${value}T${end ? '23:59:59.999' : '00:00:00.000'}+09:00`
          : value,
      );
    const from = query.from ? boundary(query.from, false) : null;
    const to = query.to ? boundary(query.to, true) : null;
    if (from && to && from > to)
      throw new BadRequestException('시작일은 종료일보다 늦을 수 없습니다.');
    const builder = this.repository
      .createQueryBuilder('h')
      .where('h.companyId = :companyId', { companyId: user.companyId });
    if (from) builder.andWhere('h.attemptedAt >= :from', { from });
    if (to) builder.andWhere('h.attemptedAt <= :to', { to });
    if (query.userId)
      builder.andWhere('h.userId = :userId', { userId: query.userId });
    if (query.result)
      builder.andWhere('h.success = :success', {
        success: query.result === 'success',
      });
    const { page, limit, offset } = normalizePaginationQuery(query);
    const [items, total] = await builder
      .orderBy('h.attemptedAt', 'DESC')
      .addOrderBy('h.id', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit };
  }
}
