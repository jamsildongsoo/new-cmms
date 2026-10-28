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

@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  // Create an attachment header linked to an owning module/document.
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateAttachmentDto) {
    return this.attachmentsService.create(user, dto);
  }

  // List file items stored under one attachment header.
  @Get(':attachmentId/items')
  findItems(
    @CurrentUser() user: UserContext,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachmentsService.findItems(user, attachmentId);
  }

  // Upload one or more files into an attachment header.
  @Post(':attachmentId/items')
  @UseInterceptors(FilesInterceptor('files'))
  uploadItems(
    @CurrentUser() user: UserContext,
    @Param('attachmentId') attachmentId: string,
    @UploadedFiles() files: UploadedAttachmentFile[],
  ) {
    return this.attachmentsService.uploadItems(user, attachmentId, files);
  }

  // Download a single attachment item by item number.
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

  // Delete one attachment item row and its physical file.
  @Delete(':attachmentId/items/:itemNo')
  removeItem(
    @CurrentUser() user: UserContext,
    @Param('attachmentId') attachmentId: string,
    @Param('itemNo', ParseIntPipe) itemNo: number,
  ) {
    return this.attachmentsService.removeItem(user, attachmentId, itemNo);
  }
}
