import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UserContext } from '../auth/types/user-context.type';
import { ModuleCode } from '../common/constants/modules';
import { NumberingService } from '../numbering/numbering.service';
import { BoardsService } from './boards.service';
import { SaveBoardDto, SaveCommentDto, SearchBoardDto } from './dto/board.dto';

// 별도 CRUD RBAC 없이 인증/회사 분리/서비스의 작성자 검사를 적용한다.
@UseGuards(JwtAuthGuard)
@Controller('boards')
export class BoardsController {
  constructor(
    private readonly service: BoardsService,
    private readonly numbering: NumberingService,
  ) {}
  @Get() list(
    @CurrentUser() user: UserContext,
    @Query() query: SearchBoardDto,
  ) {
    return this.service.list(user, query);
  }
  @Get(':boardId') get(
    @CurrentUser() user: UserContext,
    @Param('boardId') id: string,
  ) {
    return this.service.get(user, id);
  }
  @Post() create(@CurrentUser() user: UserContext, @Body() dto: SaveBoardDto) {
    return this.numbering.createDocument(
      user,
      ModuleCode.BORD,
      (id) => this.service.create(user, id, dto),
      dto.attachmentId,
    );
  }
  @Patch(':boardId') update(
    @CurrentUser() user: UserContext,
    @Param('boardId') id: string,
    @Body() dto: SaveBoardDto,
  ) {
    return this.numbering.saveDocument(
      user,
      ModuleCode.BORD,
      id,
      dto.attachmentId,
      () => this.service.update(user, id, dto),
    );
  }
  @Delete(':boardId') remove(
    @CurrentUser() user: UserContext,
    @Param('boardId') id: string,
  ) {
    return this.service.remove(user, id);
  }
  @Post(':boardId/comments') createComment(
    @CurrentUser() user: UserContext,
    @Param('boardId') id: string,
    @Body() dto: SaveCommentDto,
  ) {
    return this.service.createComment(user, id, dto);
  }
  @Patch(':boardId/comments/:commentId') updateComment(
    @CurrentUser() user: UserContext,
    @Param('boardId') id: string,
    @Param('commentId') commentId: string,
    @Body() dto: SaveCommentDto,
  ) {
    return this.service.updateComment(user, id, commentId, dto);
  }
  @Delete(':boardId/comments/:commentId') removeComment(
    @CurrentUser() user: UserContext,
    @Param('boardId') id: string,
    @Param('commentId') commentId: string,
  ) {
    return this.service.removeComment(user, id, commentId);
  }
}
