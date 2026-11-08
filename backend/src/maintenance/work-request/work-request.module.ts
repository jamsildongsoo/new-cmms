import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipment } from '../equipment/entities/equipment.entity';
import { WorkRequest } from './entities/work-request.entity';
import { WorkRequestController } from './work-request.controller';
import { WorkRequestService } from './work-request.service';
@Module({
  imports: [TypeOrmModule.forFeature([WorkRequest, Equipment])],
  controllers: [WorkRequestController],
  providers: [WorkRequestService],
  exports: [WorkRequestService],
})
export class WorkRequestModule {}
