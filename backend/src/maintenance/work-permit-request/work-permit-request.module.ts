import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkPermitRequest } from './entities/work-permit-request.entity';
import { WorkPermitRequestController } from './work-permit-request.controller';
import { WorkPermitRequestService } from './work-permit-request.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkPermitRequest])],
  controllers: [WorkPermitRequestController],
  providers: [WorkPermitRequestService],
  exports: [WorkPermitRequestService],
})
export class WorkPermitRequestModule {}
