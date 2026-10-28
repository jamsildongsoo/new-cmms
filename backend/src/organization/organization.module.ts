import { Module } from '@nestjs/common';
import { CompaniesModule } from './companies/companies.module';
import { DepartmentsModule } from './departments/departments.module';
import { SitesModule } from './sites/sites.module';
import { WarehousesModule } from './warehouses/warehouses.module';

@Module({
  imports: [CompaniesModule, SitesModule, DepartmentsModule, WarehousesModule],
  exports: [CompaniesModule, SitesModule, DepartmentsModule, WarehousesModule],
})
export class OrganizationModule {}
