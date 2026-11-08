import { WorkPermitRequestModule } from '../work-permit-request/work-permit-request.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkPermit } from './entities/work-permit.entity';
import { WorkPermitController } from './work-permit.controller';
import { WorkPermitService } from './work-permit.service';

@Module({
  imports: [WorkPermitRequestModule, TypeOrmModule.forFeature([WorkPermit])],
  controllers: [WorkPermitController],
  providers: [WorkPermitService],
  exports: [WorkPermitService],
})
export class WorkPermitModule {}
