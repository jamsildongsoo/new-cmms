import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../identity/users/entities/user.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { Equipment } from '../../maintenance/equipment/entities/equipment.entity';
import { Material } from '../../inventory/material/entities/material.entity';
import { DirectoryController } from './directory.controller';
import { DirectoryService } from './directory.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Department, Equipment, Material])],
  controllers: [DirectoryController],
  providers: [DirectoryService],
  exports: [DirectoryService],
})
export class DirectoryModule {}
