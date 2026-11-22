import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UserContext } from '../auth/types/user-context.type';
import {
  AttachmentsService,
  type UploadedAttachmentFile,
} from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';

// 첨부 API는 JWT 인증만 적용한다. 개별 업무 권한·작성자·원문 접근 권한은 검사하지 않는다.
// 프런트의 첨부 키를 사용하되 회사는 전송값이 아닌 인증된 UserContext로 확인한다.
@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  // 문서 저장 전에는 refId=null로 그룹을 만들고 최초 저장 후 문서번호를 연결한다.
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateAttachmentDto) {
    return this.attachmentsService.create(user, dto);
  }

  // 첨부 그룹에 속한 파일 메타데이터를 반환한다. 파일이 없으면 빈 배열을 반환한다.
  @Get(':attachmentId/items')
  findItems(
    @CurrentUser() user: UserContext,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachmentsService.findItems(user, attachmentId);
  }

  // 수신 단계에서 크기·개수를 제한하고, 서비스에서 인증 회사·합계 용량·유형을 확인한다.
  @Post(':attachmentId/items')
  @UseInterceptors(FilesInterceptor('files'))
  uploadItems(
    @CurrentUser() user: UserContext,
    @Param('attachmentId') attachmentId: string,
    @UploadedFiles() files: UploadedAttachmentFile[],
  ) {
    return this.attachmentsService.uploadItems(user, attachmentId, files);
  }

  // 회사와 첨부 소속을 확인한 파일을 저장소에서 읽어 다운로드 응답으로 전달한다.
  @Get(':attachmentId/items/:itemNo/download')
  async downloadItem(
    @CurrentUser() user: UserContext,
    @Param('attachmentId') attachmentId: string,
    @Param('itemNo', ParseIntPipe) itemNo: number,
    @Res() response: Response,
  ) {
    const download = await this.attachmentsService.downloadItem(
      user,
      attachmentId,
      itemNo,
    );

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(download.item.originalName)}"`,
    );
    if (download.item.mimeType) {
      response.setHeader('Content-Type', download.item.mimeType);
    }
    response.send(download.buffer);
  }

  // 실제 파일과 상세 행만 삭제하며 첨부 그룹 헤더는 유지한다.
  @Delete(':attachmentId/items/:itemNo')
  removeItem(
    @CurrentUser() user: UserContext,
    @Param('attachmentId') attachmentId: string,
    @Param('itemNo', ParseIntPipe) itemNo: number,
  ) {
    return this.attachmentsService.removeItem(user, attachmentId, itemNo);
  }
}
