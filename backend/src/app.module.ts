import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { CodesModule } from './codes/codes.module';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { validateEnv } from './config/env.schema';
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
    EquipmentModule,
    PreventiveMaintenanceModule,
    WorkOrderModule,
    WorkPermitModule,
    PurchaseRequestModule,
    PurchaseOrderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
