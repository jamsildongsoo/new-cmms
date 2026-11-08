/** 같은 회사의 게시글·댓글을 제공하고 각 작성자만 변경한다. 활성 댓글이 있으면 원문 삭제를 차단한다. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import type { UserContext } from '../auth/types/user-context.type';
import { normalizePaginationQuery } from '../common/utils/pagination.util';
import { SaveBoardDto, SaveCommentDto, SearchBoardDto } from './dto/board.dto';
import { Board } from './entities/board.entity';
import { BoardComment } from './entities/board-comment.entity';

@Injectable()
export class BoardsService {
  constructor(private readonly db: DataSource) {}

  async list(user: UserContext, query: SearchBoardDto = {}) {
    const { page, limit, offset } = normalizePaginationQuery(query);
    const builder = this.db
      .getRepository(Board)
      .createQueryBuilder('b')
      .where('b.companyId = :companyId', { companyId: user.companyId })
      .andWhere("b.deleteYn = 'N'");
    if (query.search?.trim())
      builder.andWhere(
        '(b.title ILIKE :search OR b.content ILIKE :search OR b.boardId ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    const [items, total] = await builder
      .orderBy('b.createdAt', 'DESC')
      .addOrderBy('b.boardId', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit };
  }

  private async active(
    user: UserContext,
    boardId: string,
    manager = this.db.manager,
    lock = false,
  ) {
    const row = await manager.getRepository(Board).findOne({
      where: { companyId: user.companyId, boardId, deleteYn: 'N' },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!row) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    return row;
  }

  async get(user: UserContext, boardId: string) {
    const row = await this.active(user, boardId);
    const comments = await this.db.getRepository(BoardComment).find({
      where: { companyId: user.companyId, boardId, deleteYn: 'N' },
      order: { createdAt: 'ASC', commentId: 'ASC' },
    });
    return Object.assign({}, row, { comments });
  }

  async create(user: UserContext, boardId: string, dto: SaveBoardDto) {
    await this.db.getRepository(Board).insert({
      companyId: user.companyId,
      boardId,
      title: this.text(dto.title, '제목', 200),
      content: this.text(dto.content, '본문', 50000),
      attachmentId: dto.attachmentId ?? null,
      createdBy: user.userId,
      deleteYn: 'N',
    });
    return this.get(user, boardId);
  }

  async update(user: UserContext, boardId: string, dto: SaveBoardDto) {
    await this.db.transaction(async (manager) => {
      const row = await this.active(user, boardId, manager, true);
      this.owner(user, row.createdBy);
      row.title = this.text(dto.title, '제목', 200);
      row.content = this.text(dto.content, '본문', 50000);
      if (dto.attachmentId !== undefined) row.attachmentId = dto.attachmentId;
      this.audit(user, row);
      await manager.getRepository(Board).save(row);
    });
    return this.get(user, boardId);
  }

  async remove(user: UserContext, boardId: string) {
    return this.db.transaction(async (manager) => {
      // 댓글 등록도 부모 행을 잠그므로, 삭제 검사 직후 댓글이 추가되는 경합을 막는다.
      const row = await this.active(user, boardId, manager, true);
      this.owner(user, row.createdBy);
      if (
        await manager
          .getRepository(BoardComment)
          .countBy({ companyId: user.companyId, boardId, deleteYn: 'N' })
      ) {
        throw new ConflictException('댓글이 있는 게시글은 삭제할 수 없습니다.');
      }
      row.deleteYn = 'Y';
      this.audit(user, row);
      await manager.getRepository(Board).save(row);
      return { boardId };
    });
  }

  async createComment(user: UserContext, boardId: string, dto: SaveCommentDto) {
    return this.db.transaction(async (manager) => {
      await this.active(user, boardId, manager, true);
      const repo = manager.getRepository(BoardComment);
      return repo.save(
        repo.create({
          companyId: user.companyId,
          boardId,
          commentId: randomUUID(),
          content: this.text(dto.content, '댓글', 5000),
          createdBy: user.userId,
          deleteYn: 'N',
        }),
      );
    });
  }

  private async comment(
    user: UserContext,
    boardId: string,
    commentId: string,
    manager: EntityManager,
  ) {
    await this.active(user, boardId, manager, true);
    const row = await manager.getRepository(BoardComment).findOneBy({
      companyId: user.companyId,
      boardId,
      commentId,
      deleteYn: 'N',
    });
    if (!row) throw new NotFoundException('댓글을 찾을 수 없습니다.');
    this.owner(user, row.createdBy);
    return row;
  }

  async updateComment(
    user: UserContext,
    boardId: string,
    commentId: string,
    dto: SaveCommentDto,
  ) {
    return this.db.transaction(async (manager) => {
      const row = await this.comment(user, boardId, commentId, manager);
      row.content = this.text(dto.content, '댓글', 5000);
      this.audit(user, row);
      return manager.getRepository(BoardComment).save(row);
    });
  }

  async removeComment(user: UserContext, boardId: string, commentId: string) {
    return this.db.transaction(async (manager) => {
      const row = await this.comment(user, boardId, commentId, manager);
      row.deleteYn = 'Y';
      this.audit(user, row);
      await manager.getRepository(BoardComment).save(row);
      return { commentId };
    });
  }

  private owner(user: UserContext, createdBy: string) {
    if (createdBy !== user.userId)
      throw new ForbiddenException('작성자만 수정·삭제할 수 있습니다.');
  }
  private audit(user: UserContext, row: Board | BoardComment) {
    row.updatedBy = user.userId;
    row.updatedAt = new Date();
  }
  private text(value: string, name: string, max: number) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
      throw new BadRequestException(`${name}을(를) 1~${max}자로 입력하십시오.`);
    return value.trim();
  }
}
