import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Observable, of, tap } from 'rxjs';
import { createHash } from 'node:crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';

const HEADER = 'idempotency-key';
const KEY_MAX_LEN = 256;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @InjectPinoLogger(IdempotencyInterceptor.name)
    private readonly logger?: PinoLogger,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest();
    const key = (req.headers?.[HEADER] ??
      req.headers?.[HEADER.toLowerCase()]) as string | undefined;

    if (!key) return next.handle();
    if (req.method !== 'POST') return next.handle();
    if (!req.user?.id) return next.handle();

    if (key.length > KEY_MAX_LEN) {
      throw new UnprocessableEntityException({
        code: 'IDEMPOTENCY_KEY_TOO_LONG',
        message: `Idempotency-Key must be at most ${KEY_MAX_LEN} chars`,
      });
    }

    const userId = BigInt(req.user.id);
    const requestHash = this.hashRequest(req);

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key_userId: { key, userId } },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        this.logger?.warn(
          { key, userId: userId.toString(), method: req.method, path: req.url },
          'idempotency conflict: different body for same key',
        );
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'Idempotency-Key was used with a different request body',
        });
      }
      const res = context.switchToHttp().getResponse();
      res.status(existing.responseStatus);
      this.logger?.debug(
        { key, status: existing.responseStatus },
        'idempotency cache hit',
      );
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap(async (body) => {
        const res = context.switchToHttp().getResponse();
        const status = res.statusCode ?? 200;
        try {
          await this.prisma.idempotencyKey.create({
            data: {
              key,
              userId,
              method: req.method,
              path: req.url,
              requestHash,
              responseStatus: status,
              responseBody: this.toJsonSafe(body),
            },
          });
        } catch (err) {
          this.logger?.debug(
            { key, err: (err as Error).message },
            'idempotency persist skipped',
          );
        }
      }),
    );
  }

  private hashRequest(req: any): string {
    const payload = JSON.stringify({
      method: req.method,
      path: req.url,
      body: req.body ?? null,
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  private toJsonSafe(value: unknown): any {
    return JSON.parse(
      JSON.stringify(value, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );
  }
}
