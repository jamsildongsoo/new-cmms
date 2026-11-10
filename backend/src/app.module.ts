import { MonthlyClosingModule } from './inventory/monthly-closing/monthly-closing.module';
/** 한 애플리케이션의 단일 PostgreSQL 연결과 업무 모듈을 구성한다. 고객별 DB 라우팅은 제공하지 않는다. */
import { BoardsModule } from './boards/boards.module';
import { InventoryModule } from './inventory/transactions/inventory.module';
import { MaterialModule } from './inventory/material/material.module';
import { VendorModule } from './purchase/vendor/vendor.module';
import { WorkPermitRequestModule } from './maintenance/work-permit-request/work-permit-request.module';
import { WorkRequestModule } from './maintenance/work-request/work-request.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { CodesModule } from './codes/codes.module';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { validateEnv } from './config/env.schema';
import { ENV_FILE_PATH } from './config/env-file';
import { jwtConfig } from './config/jwt.config';
import { storageConfig } from './config/storage.config';
import { IdentityModule } from './identity/identity.module';
import { EquipmentModule } from './maintenance/equipment/equipment.module';
import { PreventiveMaintenanceModule } from './maintenance/preventive-maintenance/preventive-maintenance.module';
import { WorkOrderModule } from './maintenance/work-order/work-order.module';
import { WorkPermitModule } from './maintenance/work-permit/work-permit.module';
import { PurchaseRequestModule } from './purchase/purchase-request/purchase-request.module';
import { PurchaseOrderModule } from './purchase/purchase-order/purchase-order.module';
import { NumberingModule } from './numbering/numbering.module';
import { OrganizationModule } from './organization/organization.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATH,
      load: [appConfig, databaseConfig, jwtConfig, storageConfig],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('database.host'),
        port: configService.getOrThrow<number>('database.port'),
        username: configService.getOrThrow<string>('database.username'),
        password: configService.getOrThrow<string>('database.password'),
        database: configService.getOrThrow<string>('database.name'),
        autoLoadEntities: true,
        synchronize: configService.getOrThrow<boolean>('database.synchronize'),
        logging: configService.getOrThrow<boolean>('database.logging'),
        ssl: configService.get<boolean>('database.ssl')
          ? {
              rejectUnauthorized: configService.getOrThrow<boolean>(
                'database.sslRejectUnauthorized',
              ),
            }
          : false,
      }),
    }),
    AuthModule,
    IdentityModule,
    OrganizationModule,
    AttachmentsModule,
    ApprovalsModule,
    CodesModule,
    NumberingModule,
    BoardsModule,
    EquipmentModule,
    MaterialModule,
    VendorModule,
    InventoryModule,
    MonthlyClosingModule,
    PreventiveMaintenanceModule,
    WorkRequestModule,
    WorkOrderModule,
    WorkPermitRequestModule,
    WorkPermitModule,
    PurchaseRequestModule,
    PurchaseOrderModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
