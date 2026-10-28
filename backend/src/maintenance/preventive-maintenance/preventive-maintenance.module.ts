import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipment } from '../equipment/entities/equipment.entity';
import { PreventiveMaintenance } from './entities/preventive-maintenance.entity';
import { PreventiveMaintenanceController } from './preventive-maintenance.controller';
import { PreventiveMaintenanceService } from './preventive-maintenance.service';

@Module({
  imports: [TypeOrmModule.forFeature([PreventiveMaintenance, Equipment])],
  controllers: [PreventiveMaintenanceController],
  providers: [PreventiveMaintenanceService],
})
export class PreventiveMaintenanceModule {}
