/** 서버 실행은 설정된 DB 동기화 정책만 적용한다. 초기 설치·관리자 생성은 bootstrap.sh로 별도 실행한다. */
/** API prefix·CORS·엄격한 DTO 검증을 설정하고 NestJS 서버를 시작한다. */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const apiPrefix = configService.getOrThrow<string>('app.apiPrefix');
  const corsOrigins = configService.getOrThrow<string[]>('app.corsOrigins');
  const port = configService.getOrThrow<number>('app.port');
  const proxyHops = configService.getOrThrow<number>('app.trustProxyHops');
  if (proxyHops > 0) app.set('trust proxy', proxyHops);

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  await app.listen(port);
}
void bootstrap();
