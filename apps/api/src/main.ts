import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { mountSwagger } from './swagger';
import { BigIntSerializerInterceptor } from './common/bigint-serializer.interceptor';
import { AuditContextInterceptor } from './common/audit-context.interceptor';
import { IdempotencyInterceptor } from './common/idempotency.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: (config.get<string>('ALLOWED_ORIGINS') ?? '')
      .split(',')
      .filter(Boolean),
    credentials: true,
  });

  app.useGlobalInterceptors(
    new BigIntSerializerInterceptor(),
    new AuditContextInterceptor(),
    app.get(IdempotencyInterceptor),
  );

  mountSwagger(app);

  // Montaje del Authorization Server (solo si está configurado). Express crudo: node-oidc-provider
  // trae sus propias rutas (/.well-known/openid-configuration, /auth, /token, /jwks, /oauth/interaction...).
  const issuer = config.get<string>('MCP_OAUTH_ISSUER');
  const audience = config.get<string>('MCP_OAUTH_AUDIENCE');
  const signing = config.get<string>('MCP_OAUTH_SIGNING_JWKS');
  if (issuer && audience && signing) {
    const { createOidcProvider } = await import('./oauth/oidc-provider.factory');
    const { PrismaService } = await import('./prisma/prisma.service');
    const provider = await createOidcProvider({
      issuer,
      audience,
      prisma: app.get(PrismaService),
      signingJwks: JSON.parse(signing),
    });
    app.getHttpAdapter().getInstance().use('/oauth', provider.callback());
  }

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);
}
bootstrap();
