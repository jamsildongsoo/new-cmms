import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

import { UserProfileController } from './user-profile.controller';
import { Company } from '../../organization/companies/entities/company.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { Role } from '../roles/entities/role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Company, Site, Department, Role])],
  controllers: [UserProfileController, UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
