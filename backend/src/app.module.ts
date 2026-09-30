import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    AuthModule,
    // 1. .env 파일 전역 사용 설정
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // 2. Supabase PostgreSQL 연결 설정
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true, // 엔티티 자동 로드
      synchronize: true,      // 개발 단계에서는 자동 스키마 동기화 (운영 단계에서는 false 권장)
      ssl: {
        rejectUnauthorized: false, // Supabase 연결 시 SSL 필수
      },
    }),
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
