import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodesModule } from '../../codes/codes.module';
import { Department } from '../../organization/departments/entities/department.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { Equipment } from './entities/equipment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Equipment, Site, Department]),
    CodesModule,
  ],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
