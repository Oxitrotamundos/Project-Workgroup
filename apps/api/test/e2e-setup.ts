import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppModule } from '../src/app.module';
import { BigIntSerializerInterceptor } from '../src/common/bigint-serializer.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaClient } from '../src/generated/prisma/client';

const API_ROOT = path.resolve(__dirname, '..');

export interface E2EHandle {
  app: INestApplication;
  container: StartedPostgreSqlContainer;
  close: () => Promise<void>;
}

class TestPrismaService extends PrismaClient {
  constructor(connectionString: string) {
    const adapter = new PrismaPg({ connectionString });
    super({ adapter } as any);
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export async function bootE2E(opts?: {
  overrideGuard?: { guard: any; value: any };
}): Promise<E2EHandle> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
    cwd: API_ROOT,
  });

  const testPrisma = new TestPrismaService(url);

  const builder = Test.createTestingModule({ imports: [AppModule] });
  builder.overrideProvider(PrismaService).useValue(testPrisma);
  if (opts?.overrideGuard) {
    builder.overrideGuard(opts.overrideGuard.guard).useValue(opts.overrideGuard.value);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new BigIntSerializerInterceptor());
  await app.init();

  return {
    app,
    container,
    close: async () => {
      await app.close();
      await container.stop();
    },
  };
}
