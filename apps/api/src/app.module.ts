import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { validateEnv } from './config/env.validation';
import { FirebaseModule } from './firebase/firebase.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { ProjectMembersModule } from './project-members/project-members.module';
import { TasksModule } from './tasks/tasks.module';
import { TaskLinksModule } from './task-links/task-links.module';
import { WorkloadModule } from './workload/workload.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { IdempotencyModule } from './common/idempotency.module';
import { ObservabilityModule } from './observability/observability.module';
import { CalendarModule } from './calendar/calendar.module';
import { McpModule } from './mcp/mcp.module';
import { OAuthCleanupService } from './oauth/oauth-cleanup.service';

const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    // Rate-limit acotado: el ThrottlerGuard solo se aplica en McpController (superficie
    // pública /mcp). No se registra como APP_GUARD para no throttlear /v1 ni el web.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
        genReqId: (req) =>
          (req.headers['x-request-id'] as string) ?? randomUUID(),
        customProps: (req) => ({ requestId: (req as any).id }),
        autoLogging: {
          ignore: (req) =>
            req.url === '/v1/health' || req.url === '/v1/metrics',
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
          ],
          remove: true,
        },
        transport: isProd
          ? undefined
          : {
              target: 'pino-pretty',
              options: { singleLine: true, colorize: true },
            },
      },
    }),
    FirebaseModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    ProjectMembersModule,
    TasksModule,
    TaskLinksModule,
    WorkloadModule,
    ApiKeysModule,
    IdempotencyModule,
    ObservabilityModule,
    CalendarModule,
    McpModule,
  ],
  providers: [OAuthCleanupService],
})
export class AppModule {}
