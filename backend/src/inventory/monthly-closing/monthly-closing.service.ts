/** 월 Open/Close는 거래 잠금만 관리하고 월 보고서는 확정 전표로 집계한다. */
import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { monthAfter, monthValue } from '../../common/utils/date.util';
import { InventoryPeriodLock } from './entities/inventory-period-lock.entity';
import { StockProcessingService } from '../stock/stock-processing.service';
import { StockQueryService } from '../stock/stock-query.service';
@Injectable()
export class MonthlyClosingService {
  constructor(
    private readonly db: DataSource,
    private readonly stock: StockProcessingService,
    private readonly queries: StockQueryService,
  ) {}
  async periods(user: UserContext) {
    return this.db.getRepository(InventoryPeriodLock).find({
      where: { companyId: user.companyId },
      order: { yearMonth: 'DESC' },
    });
  }
  /** 거래와 같은 회사 잠금 안에서 월 상태만 바꾼다. 차월 Open이나 잔고 재계산을 함께 실행하지 않는다. */
  async periodAction(
    user: UserContext,
    month: string,
    action: 'open' | 'unlock' | 'close',
  ) {
    monthValue(month);
    await this.db.transaction(async (manager) => {
      await this.stock.companyLock(manager, user.companyId);
      const repo = manager.getRepository(InventoryPeriodLock),
        key = { companyId: user.companyId, yearMonth: month };
      let row = await repo.findOneBy(key);
      if (action === 'close') {
        if (!row) throw new ConflictException('Open된 월이 아닙니다.');
        const earlier = await repo
          .createQueryBuilder('p')
          .where('p.companyId=:companyId', { companyId: user.companyId })
          .andWhere('p."yearMonth" < :month', { month })
          .orderBy('p.yearMonth', 'DESC')
          .getOne();
        if (
          earlier &&
          (!earlier.locked || earlier.yearMonth !== monthAfter(month, -1))
        )
          throw new ConflictException(
            '누락 월을 개시하고 전월부터 순서대로 마감하십시오.',
          );
        row.locked = true;
      } else {
        if (action === 'unlock' && !row)
          throw new ConflictException('Open된 월이 아닙니다.');
        if (action === 'open' && row?.locked)
          throw new ConflictException('마감 월은 Lock 해제를 사용하십시오.');
        row ??= repo.create({ ...key, createdBy: user.userId });
        row.locked = false;
      }
      row.updatedBy = user.userId;
      row.updatedAt = new Date();
      await repo.save(row);
    });
    return this.monthly(user, month);
  }
  async monthly(user: UserContext, month: string) {
    monthValue(month);
    const [period, report] = await Promise.all([
      this.db
        .getRepository(InventoryPeriodLock)
        .findOneBy({ companyId: user.companyId, yearMonth: month }),
      this.queries.monthly(user, month),
    ]);
    return { period, ...report };
  }
}
