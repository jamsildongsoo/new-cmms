import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkPermit } from './entities/work-permit.entity';
import { WorkPermitController } from './work-permit.controller';
import { WorkPermitService } from './work-permit.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkPermit])],
  controllers: [WorkPermitController],
  providers: [WorkPermitService],
})
export class WorkPermitModule {}
