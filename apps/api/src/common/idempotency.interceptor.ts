import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Observable, catchError, concatMap, from, of, throwError } from 'rxjs';
import { createHash } from 'node:crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const HEADER = 'idempotency-key';
const KEY_MAX_LEN = 256;
// responseStatus 0 marca un claim pendiente; cualquier otro valor es una respuesta ya materializada.
const PENDING = 0;
const MAX_ATTEMPTS = 2;
// Reintentos acotados para el update que materializa la respuesta (blips transitorios de BD).
const PERSIST_MAX_ATTEMPTS = 3;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  // Un claim pendiente más viejo que esto se considera huérfano (su dueño murió) y se puede retomar.
  private static readonly STALE_MS = 60_000;

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

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // (A) Intentamos reclamar la clave de forma atómica: el unique([key,userId]) arbitra la carrera.
      try {
        await this.prisma.idempotencyKey.create({
          data: {
            key,
            userId,
            method: req.method,
            path: req.url,
            requestHash,
            responseStatus: PENDING,
            // responseBody se omite ⇒ queda null hasta que el handler termine.
          },
        });
      } catch (err) {
        if (!this.isUniqueViolation(err)) throw err;

        // (C) Otro request ya posee la clave: inspeccionamos su estado.
        const existing = await this.prisma.idempotencyKey.findUnique({
          where: { key_userId: { key, userId } },
        });
        if (!existing) continue; // liberada en una ventana mínima → reintentar el claim

        if (existing.responseStatus !== PENDING) {
          if (existing.requestHash !== requestHash) {
            this.logger?.warn(
              {
                key,
                userId: userId.toString(),
                method: req.method,
                path: req.url,
              },
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

        // Claim pendiente: si está huérfano lo retomamos, si está vivo devolvemos 409.
        if (this.isStale(existing.createdAt)) {
          await this.release(key, userId);
          continue;
        }
        throw new ConflictException({
          code: 'IDEMPOTENCY_IN_PROGRESS',
          message:
            'A request with this Idempotency-Key is already in progress; retry shortly',
        });
      }

      // (B) Ganamos el claim: ejecutamos el handler una sola vez y persistimos (await) o liberamos.
      const res = context.switchToHttp().getResponse();
      // Se pone en true justo cuando el handler emite: distingue "falló el handler" (libera)
      // de "falló persistir después de que el handler ya commiteó" (no libera, ver abajo).
      let handlerEmitted = false;
      return next.handle().pipe(
        concatMap(async (body) => {
          handlerEmitted = true;
          const status = res.statusCode ?? 200;
          await this.persistResponse(
            key,
            userId,
            status,
            this.toJsonSafe(body),
          );
          return body; // emitimos solo tras commitear la fila
        }),
        catchError((err) => {
          if (handlerEmitted) {
            // El handler ya emitió (y, en mutaciones, ya commiteó). Liberar aquí dejaría
            // la puerta abierta a que un retry re-ejecute la mutación ya hecha → duplicado.
            // Dejamos el claim PENDING: un retry inmediato choca con IDEMPOTENCY_IN_PROGRESS.
            return throwError(() => err);
          }
          // Handler falló antes de emitir → liberamos la clave para que el cliente pueda reintentar.
          return from(this.release(key, userId)).pipe(
            concatMap(() => throwError(() => err)),
          );
        }),
      );
    }

    // Bucle agotado (el claim siguió colisionando) → lo tratamos como concurrencia en curso.
    throw new ConflictException({
      code: 'IDEMPOTENCY_IN_PROGRESS',
      message:
        'A request with this Idempotency-Key is already in progress; retry shortly',
    });
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    );
  }

  private isStale(createdAt: Date): boolean {
    return Date.now() - createdAt.getTime() > IdempotencyInterceptor.STALE_MS;
  }

  // Reintenta un número acotado de veces antes de propagar (blip transitorio de BD).
  private async persistResponse(
    key: string,
    userId: bigint,
    status: number,
    body: Prisma.InputJsonValue,
  ): Promise<void> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < PERSIST_MAX_ATTEMPTS; attempt++) {
      try {
        await this.prisma.idempotencyKey.update({
          where: { key_userId: { key, userId } },
          data: {
            responseStatus: status,
            responseBody: body,
          },
        });
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  private async release(key: string, userId: bigint): Promise<void> {
    try {
      await this.prisma.idempotencyKey.delete({
        where: { key_userId: { key, userId } },
      });
    } catch {
      // Ya no existe — ignoramos.
    }
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
