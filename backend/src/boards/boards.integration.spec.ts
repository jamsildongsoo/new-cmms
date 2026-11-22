import { Test } from '@nestjs/testing';
import {
  ExecutionContext,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { INestApplication } from '@nestjs/common';
import type { UserContext } from '../auth/types/user-context.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NumberingService } from '../numbering/numbering.service';
import { NumberSequence } from '../numbering/entities/number-sequence.entity';
import { Attachment } from '../attachments/entities/attachment.entity';
import { postgresTestDatabase } from '../../test/support/pglite';
import { Board } from './entities/board.entity';
import { BoardComment } from './entities/board-comment.entity';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';

jest.setTimeout(90000);
const actor = (userId = 'owner', companyId = 'A') =>
  ({
    companyId,
    userId,
    roleId: 'ADMIN',
    siteId: null,
    deptId: 'D1',
    accessScope: 'OWN_SITE',
    permissions: [],
  }) as UserContext;
const entities = [Board, BoardComment, NumberSequence, Attachment];
let db: DataSource,
  service: BoardsService,
  numbering: NumberingService,
  close: () => Promise<void>,
  app: INestApplication;
beforeAll(async () => {
  const fixture = await postgresTestDatabase(entities);
  db = fixture.dataSource;
  close = fixture.close;
  service = new BoardsService(db);
  numbering = new NumberingService(db);
  const module = await Test.createTestingModule({
    controllers: [BoardsController],
    providers: [
      { provide: BoardsService, useValue: service },
      { provide: NumberingService, useValue: numbering },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate(context: ExecutionContext) {
        const req = context
          .switchToHttp()
          .getRequest<{ headers: Record<string, string>; user: UserContext }>();
        if (!req.headers['x-test-user']) throw new UnauthorizedException();
        req.user = actor(
          req.headers['x-test-user'],
          req.headers['x-test-company'] ?? 'A',
        );
        return true;
      },
    })
    .compile();
  app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
});
afterAll(async () => {
  if (app) await app.close();
  if (close) await close();
});
beforeEach(async () => {
  for (const entity of entities) await db.getRepository(entity).clear();
});
function api() {
  return request(app.getHttpServer() as Parameters<typeof request>[0]);
}
async function post(user = actor(), extra = {}) {
  return numbering.createDocument(user, 'BORD', (id) =>
    service.create(user, id, {
      title: '공지 제목',
      content: '본문',
      ...extra,
    }),
  );
}


it('requires authentication and lets an authenticated user without module permissions create/read a numbered post', async () => {
  await api().get('/boards').expect(401);
  const payload = { title: '제목', content: '본문' };
  const first = await api()
    .post('/boards')
    .set('x-test-user', 'owner')
    .send(payload)
    .expect(201);
  const id = (first.body as Board).boardId;
  expect(id).toMatch(/^BORD-\d{6}-00001$/);
  const retry = await api()
    .post('/boards')
    .set('x-test-user', 'owner')
    .send(payload)
    .expect(201);
  expect((retry.body as Board).boardId).not.toBe(id);
  expect(await db.getRepository(Board).count()).toBe(2);
  await api().get(`/boards/${id}`).set('x-test-user', 'reader').expect(200);
});
it('accepts owner edits and denies another user even with an admin role', async () => {
  const board = await post();
  await api()
    .patch(`/boards/${board.boardId}`)
    .set('x-test-user', 'reader')
    .send({ title: '변경', content: '변경' })
    .expect(403);
  await api()
    .delete(`/boards/${board.boardId}`)
    .set('x-test-user', 'reader')
    .expect(403);
  const edited = await api()
    .patch(`/boards/${board.boardId}`)
    .set('x-test-user', 'owner')
    .send({ title: '수정 제목', content: '수정 본문' })
    .expect(200);
  expect((edited.body as Board).updatedBy).toBe('owner');
  expect((edited.body as Board).createdBy).toBe('owner');
  expect((edited.body as Board).boardId).toBe(board.boardId);
});
it('isolates companies for lists, posts and every comment mutation', async () => {
  const board = await post(),
    foreign = actor('owner', 'B');
  const comment = await service.createComment(actor(), board.boardId, {
    content: '비공개 회사 댓글',
  });
  expect((await service.list(foreign)).items).toHaveLength(0);
  await expect(service.get(foreign, board.boardId)).rejects.toThrow(
    '찾을 수 없습니다',
  );
  await expect(
    service.update(foreign, board.boardId, { title: '제목', content: '본문' }),
  ).rejects.toThrow('찾을 수 없습니다');
  await expect(service.remove(foreign, board.boardId)).rejects.toThrow(
    '찾을 수 없습니다',
  );
  await expect(
    service.createComment(foreign, board.boardId, { content: '댓글' }),
  ).rejects.toThrow('찾을 수 없습니다');
  await expect(
    service.updateComment(foreign, board.boardId, comment.commentId, {
      content: '변경',
    }),
  ).rejects.toThrow('찾을 수 없습니다');
  await expect(
    service.removeComment(foreign, board.boardId, comment.commentId),
  ).rejects.toThrow('찾을 수 없습니다');
});
it('allows comments by another user, but only that commenter can edit/delete them', async () => {
  const board = await post();
  const created = await api()
    .post(`/boards/${board.boardId}/comments`)
    .set('x-test-user', 'reader')
    .send({ content: '독자 댓글' })
    .expect(201);
  const comment = created.body as BoardComment;
  expect(comment.createdBy).toBe('reader');
  expect(comment.commentId).toMatch(/^[0-9a-f-]{36}$/);
  await api()
    .patch(`/boards/${board.boardId}/comments/${comment.commentId}`)
    .set('x-test-user', 'owner')
    .send({ content: '관리자 변경' })
    .expect(403);
  await api()
    .delete(`/boards/${board.boardId}/comments/${comment.commentId}`)
    .set('x-test-user', 'owner')
    .expect(403);
  const edited = await api()
    .patch(`/boards/${board.boardId}/comments/${comment.commentId}`)
    .set('x-test-user', 'reader')
    .send({ content: '댓글 수정' })
    .expect(200);
  expect((edited.body as BoardComment).updatedBy).toBe('reader');
  await api()
    .delete(`/boards/${board.boardId}/comments/${comment.commentId}`)
    .set('x-test-user', 'reader')
    .expect(200);
  expect((await service.get(actor(), board.boardId)).comments).toHaveLength(0);
});
it('rejects post deletion while comments remain, permits body edits, and permits deletion after all comments are deleted', async () => {
  const board = await post(),
    commenter = actor('reader');
  const comment = await service.createComment(commenter, board.boardId, {
    content: '댓글',
  });
  await api()
    .delete(`/boards/${board.boardId}`)
    .set('x-test-user', 'owner')
    .expect(409);
  await service.update(actor(), board.boardId, {
    title: '본문 수정 허용',
    content: '새 본문',
  });
  await service.removeComment(commenter, board.boardId, comment.commentId);
  await api()
    .delete(`/boards/${board.boardId}`)
    .set('x-test-user', 'owner')
    .expect(200);
  expect(
    (await db.getRepository(Board).findOneByOrFail({ boardId: board.boardId }))
      .deleteYn,
  ).toBe('Y');
  expect(
    (
      await db
        .getRepository(BoardComment)
        .findOneByOrFail({ commentId: comment.commentId })
    ).deleteYn,
  ).toBe('Y');
  await api()
    .get(`/boards/${board.boardId}`)
    .set('x-test-user', 'reader')
    .expect(404);
  await api()
    .post(`/boards/${board.boardId}/comments`)
    .set('x-test-user', 'reader')
    .send({ content: '삭제 후 댓글' })
    .expect(404);
});
it('blocks deletion for the author’s own comments too', async () => {
  const board = await post();
  await service.createComment(actor(), board.boardId, { content: '본인 댓글' });
  await expect(service.remove(actor(), board.boardId)).rejects.toThrow(
    '댓글이 있는',
  );
});
it('does not allow a comment ID to be used under another post', async () => {
  const first = await post(),
    second = await post();
  const comment = await service.createComment(actor(), first.boardId, {
    content: '첫 글 댓글',
  });
  await expect(
    service.updateComment(actor(), second.boardId, comment.commentId, {
      content: '잘못된 경로',
    }),
  ).rejects.toThrow('찾을 수 없습니다');
  await expect(
    service.removeComment(actor(), second.boardId, comment.commentId),
  ).rejects.toThrow('찾을 수 없습니다');
});
it('rejects forged company/author/status/ID and blank post/comment bodies', async () => {
  await api()
    .post('/boards')
    .set('x-test-user', 'owner')
    .send({
      title: '제목',
      content: '본문',
      companyId: 'B',
      createdBy: 'reader',
      boardId: 'BORD-forged',
      status: 'C',
    })
    .expect(400);
  await api()
    .post('/boards')
    .set('x-test-user', 'owner')
    .send({ title: ' ', content: '본문' })
    .expect(400);
  const board = await post();
  await api()
    .post(`/boards/${board.boardId}/comments`)
    .set('x-test-user', 'reader')
    .send({ content: ' ', createdBy: 'owner' })
    .expect(400);
  await api()
    .post(`/boards/${board.boardId}/comments`)
    .set('x-test-user', 'reader')
    .send({ content: ' ' })
    .expect(400);
});
it('paginates and searches only non-deleted posts in the authenticated company', async () => {
  const first = await post(),
    second = await post(actor(), { title: '검색 대상' });
  await post(actor('owner', 'B'), { title: '검색 대상' });
  const result = await service.list(actor(), {
    search: '검색 대상',
    page: 1,
    limit: 1,
  });
  expect(result.total).toBe(1);
  expect(result.items[0].boardId).toBe(second.boardId);
  expect(
    (await service.list(actor(), { page: 2, limit: 1 })).items,
  ).toHaveLength(1);
  await service.remove(actor(), first.boardId);
  expect((await service.list(actor())).total).toBe(1);
});
it('binds a pre-save UUID attachment group to the BORD document ID', async () => {
  const attachment = await db.getRepository(Attachment).save({
    companyId: 'A',
    attachmentId: randomUUID(),
    refModule: 'BORD',
    refId: null,
    createdBy: 'owner',
  });
  const response = await api()
    .post('/boards')
    .set('x-test-user', 'owner')
    .send({
      title: '첨부 글',
      content: '본문',
      attachmentId: attachment.attachmentId,
    })
    .expect(201);
  const board = response.body as Board;
  expect(board.attachmentId).toBe(attachment.attachmentId);
  expect(
    (
      await db
        .getRepository(Attachment)
        .findOneByOrFail({ attachmentId: attachment.attachmentId })
    ).refId,
  ).toBe(board.boardId);
});

it('returns lightweight list rows while searching literal special characters in the full body', async () => {
  const row = await post(actor(), { content: String.raw`본문 100%_값 \경로` });
  await post(actor(), { title: '100xx값', content: '일반 본문' });
  for (const search of ['%', '_', '\\', '본문 100%_값']) {
    const result = await service.list(actor(), { search });
    expect(result.total).toBe(1);
    expect(result.items[0].boardId).toBe(row.boardId);
    expect(Object.keys(result.items[0]).sort()).toEqual(
      ['boardId', 'title', 'createdBy', 'createdAt'].sort(),
    );
  }
  expect((await service.get(actor(), row.boardId)).content).toBe(
    String.raw`본문 100%_값 \경로`,
  );
});
