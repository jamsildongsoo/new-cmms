import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { Board } from './entities/board.entity';
import { BoardComment } from './entities/board-comment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Board, BoardComment])],
  controllers: [BoardsController],
  providers: [BoardsService],
})
export class BoardsModule {}
