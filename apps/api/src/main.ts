import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { mountSwagger } from './swagger';
import { BigIntSerializerInterceptor } from './common/bigint-serializer.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({
    origin: (config.get<string>('ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  app.useGlobalInterceptors(new BigIntSerializerInterceptor());

  mountSwagger(app);

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);
}
bootstrap();
