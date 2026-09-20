import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Every route here returns personalized, frequently-changing data behind auth.
  // Express's default auto-ETag doesn't vary by Authorization header, so the
  // browser can revalidate against a stale cached body (304) and never see new data.
  app.set('etag', false);

  // Rate limiting keys anonymous callers by req.ip. Behind a reverse proxy that is the
  // proxy's address unless Express is told how many hops to trust. Unset = trust nothing.
  // Use a hop count ("1") or specific addresses ("loopback", CIDRs) — never "true", which
  // believes any client-supplied X-Forwarded-For and lets callers choose their own bucket.
  const trustProxy = config.get<string>('TRUST_PROXY')?.trim();
  if (trustProxy) {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }

  app.setGlobalPrefix('api');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const allowedOrigins = (config.get('FRONTEND_URL') ?? '')
    .split(',')
    .map((origin: string) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  await app.listen(config.get('PORT') ?? 3001);
}
bootstrap();
