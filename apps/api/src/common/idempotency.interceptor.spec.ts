import { ConflictException, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { Prisma } from '../generated/prisma/client';
import { IdempotencyInterceptor } from './idempotency.interceptor';

const makeContext = (
  req: any,
  res: any = { statusCode: 201, status: jest.fn() },
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  }) as unknown as ExecutionContext;

const makePrisma = () => ({
  idempotencyKey: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
});

// Construye un error de violación de unique (P2002) como el del runtime de Prisma.
const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: 'x',
  });

describe('IdempotencyInterceptor', () => {
  it('passes through when no Idempotency-Key header is present', async () => {
    const prisma = makePrisma();
    const interceptor = new IdempotencyInterceptor(prisma as any);
    const ctx = makeContext({
      headers: {},
      method: 'POST',
      user: { id: 1n },
      body: {},
    });
    const result$ = await interceptor.intercept(ctx, {
      handle: () => of('passthrough'),
    } as any);
    await expect(firstValueFrom(result$)).resolves.toBe('passthrough');
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
    expect(prisma.idempotencyKey.findUnique).not.toHaveBeenCalled();
  });

  it('passes through for non-POST methods even with header', async () => {
    const prisma = makePrisma();
    const interceptor = new IdempotencyInterceptor(prisma as any);
    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'GET',
      user: { id: 1n },
      body: {},
    });
    const result$ = await interceptor.intercept(ctx, {
      handle: () => of('ok'),
    } as any);
    await expect(firstValueFrom(result$)).resolves.toBe('ok');
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
    expect(prisma.idempotencyKey.findUnique).not.toHaveBeenCalled();
  });

  it('claims the key before the handler then persists the real response via update', async () => {
    const prisma = makePrisma();
    prisma.idempotencyKey.create.mockResolvedValue({});

    const interceptor = new IdempotencyInterceptor(prisma as any);
    (interceptor as any).hashRequest = () => 'sha-new';

    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'POST',
      url: '/v1/projects/import',
      user: { id: 1n },
      body: { name: 'C' },
    });

    const result$ = await interceptor.intercept(ctx, {
      handle: () => of({ id: '42' }),
    } as any);
    await expect(firstValueFrom(result$)).resolves.toEqual({ id: '42' });

    // El claim guarda un sentinel pendiente (responseStatus 0) sin responseBody.
    const createArg = prisma.idempotencyKey.create.mock.calls[0][0];
    expect(createArg.data).toEqual(
      expect.objectContaining({
        key: 'k1',
        userId: 1n,
        requestHash: 'sha-new',
        responseStatus: 0,
      }),
    );
    expect(createArg.data).not.toHaveProperty('responseBody');

    // Tras el handler, el update materializa la respuesta real.
    expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key_userId: { key: 'k1', userId: 1n } },
        data: expect.objectContaining({
          responseStatus: 201,
          responseBody: { id: '42' },
        }),
      }),
    );
  });

  it('replays the cached response when a completed key matches the same body hash', async () => {
    const prisma = makePrisma();
    prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation());
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: 'sha-abc',
      responseStatus: 201,
      responseBody: { id: 'cached' },
      createdAt: new Date(),
    });

    const interceptor = new IdempotencyInterceptor(prisma as any);
    (interceptor as any).hashRequest = () => 'sha-abc';

    const handle = jest.fn(() => of({ id: 'fresh' }));
    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'POST',
      url: '/v1/projects/import',
      user: { id: 1n },
      body: { name: 'A' },
    });

    const result$ = await interceptor.intercept(ctx, { handle } as any);
    await expect(firstValueFrom(result$)).resolves.toEqual({ id: 'cached' });
    expect(handle).not.toHaveBeenCalled();
    expect(prisma.idempotencyKey.update).not.toHaveBeenCalled();
  });

  it('throws ConflictException when a completed key is reused with a different body', async () => {
    const prisma = makePrisma();
    prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation());
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: 'sha-old',
      responseStatus: 201,
      responseBody: {},
      createdAt: new Date(),
    });

    const interceptor = new IdempotencyInterceptor(prisma as any);
    (interceptor as any).hashRequest = () => 'sha-new';

    const handle = jest.fn(() => of('x'));
    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'POST',
      url: '/v1/projects/import',
      user: { id: 1n },
      body: { name: 'B' },
    });

    const err = await interceptor
      .intercept(ctx, { handle } as any)
      .catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
    expect(handle).not.toHaveBeenCalled();
  });

  it('throws 409 IDEMPOTENCY_IN_PROGRESS when a fresh pending claim is held by a concurrent request', async () => {
    const prisma = makePrisma();
    prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation());
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: 'sha-x',
      responseStatus: 0,
      responseBody: null,
      createdAt: new Date(),
    });

    const interceptor = new IdempotencyInterceptor(prisma as any);
    (interceptor as any).hashRequest = () => 'sha-x';

    const handle = jest.fn(() => of('x'));
    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'POST',
      url: '/v1/projects/import',
      user: { id: 1n },
      body: { name: 'B' },
    });

    const err = await interceptor
      .intercept(ctx, { handle } as any)
      .catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'IDEMPOTENCY_IN_PROGRESS',
    });
    expect(handle).not.toHaveBeenCalled();
    expect(prisma.idempotencyKey.delete).not.toHaveBeenCalled();
  });

  it('releases the claim (delete) when the handler fails so the key is retryable', async () => {
    const prisma = makePrisma();
    prisma.idempotencyKey.create.mockResolvedValue({});

    const interceptor = new IdempotencyInterceptor(prisma as any);
    (interceptor as any).hashRequest = () => 'sha-new';

    const boom = new Error('handler exploded');
    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'POST',
      url: '/v1/projects/import',
      user: { id: 1n },
      body: { name: 'C' },
    });

    const result$ = await interceptor.intercept(ctx, {
      handle: () => throwError(() => boom),
    } as any);

    await expect(firstValueFrom(result$)).rejects.toBe(boom);
    expect(prisma.idempotencyKey.delete).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.delete).toHaveBeenCalledWith({
      where: { key_userId: { key: 'k1', userId: 1n } },
    });
    expect(prisma.idempotencyKey.update).not.toHaveBeenCalled();
  });

  it('does NOT release the claim when persisting the response fails after the handler already emitted', async () => {
    const prisma = makePrisma();
    prisma.idempotencyKey.create.mockResolvedValue({});
    const persistErr = new Error('db blip while persisting response');
    prisma.idempotencyKey.update.mockRejectedValue(persistErr);

    const interceptor = new IdempotencyInterceptor(prisma as any);
    (interceptor as any).hashRequest = () => 'sha-new';

    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'POST',
      url: '/v1/projects/import',
      user: { id: 1n },
      body: { name: 'C' },
    });

    const result$ = await interceptor.intercept(ctx, {
      handle: () => of({ id: '42' }),
    } as any);

    await expect(firstValueFrom(result$)).rejects.toBe(persistErr);
    // El handler ya commiteó su mutación: liberar la key aquí duplicaría el efecto en un retry.
    expect(prisma.idempotencyKey.delete).not.toHaveBeenCalled();
    // Se agotó el retry acotado de persistencia.
    expect(prisma.idempotencyKey.update).toHaveBeenCalledTimes(3);
  });

  it('persists the response on a later retry when the first persist attempts fail transiently', async () => {
    const prisma = makePrisma();
    prisma.idempotencyKey.create.mockResolvedValue({});
    const blip = new Error('db blip while persisting response');
    prisma.idempotencyKey.update
      .mockRejectedValueOnce(blip)
      .mockRejectedValueOnce(blip)
      .mockResolvedValueOnce({});

    const interceptor = new IdempotencyInterceptor(prisma as any);
    (interceptor as any).hashRequest = () => 'sha-new';

    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'POST',
      url: '/v1/projects/import',
      user: { id: 1n },
      body: { name: 'C' },
    });

    const result$ = await interceptor.intercept(ctx, {
      handle: () => of({ id: '42' }),
    } as any);

    await expect(firstValueFrom(result$)).resolves.toEqual({ id: '42' });
    expect(prisma.idempotencyKey.update).toHaveBeenCalledTimes(3);
    expect(prisma.idempotencyKey.delete).not.toHaveBeenCalled();
  });

  it('rejects a retry with IDEMPOTENCY_IN_PROGRESS while a persist-failed claim is still pending and fresh', async () => {
    const prisma = makePrisma();
    // Simula el estado que deja el fix: la key sigue PENDING en DB porque la persistencia falló.
    prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation());
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: 'sha-new',
      responseStatus: 0,
      responseBody: null,
      createdAt: new Date(),
    });

    const interceptor = new IdempotencyInterceptor(prisma as any);
    (interceptor as any).hashRequest = () => 'sha-new';

    const handle = jest.fn(() => of('should-not-run'));
    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'POST',
      url: '/v1/projects/import',
      user: { id: 1n },
      body: { name: 'C' },
    });

    const err = await interceptor
      .intercept(ctx, { handle } as any)
      .catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'IDEMPOTENCY_IN_PROGRESS',
    });
    expect(handle).not.toHaveBeenCalled();
  });

  it('takes over a stale pending claim by releasing it then re-claiming on the next attempt', async () => {
    const prisma = makePrisma();
    prisma.idempotencyKey.create
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValue({});
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: 'sha-x',
      responseStatus: 0,
      responseBody: null,
      createdAt: new Date(Date.now() - 120_000),
    });

    const interceptor = new IdempotencyInterceptor(prisma as any);
    (interceptor as any).hashRequest = () => 'sha-x';

    const handle = jest.fn(() => of({ id: '99' }));
    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'POST',
      url: '/v1/projects/import',
      user: { id: 1n },
      body: { name: 'C' },
    });

    const result$ = await interceptor.intercept(ctx, { handle } as any);
    await expect(firstValueFrom(result$)).resolves.toEqual({ id: '99' });

    // El claim muerto se libera antes del segundo intento exitoso.
    expect(prisma.idempotencyKey.delete).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.create).toHaveBeenCalledTimes(2);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.update).toHaveBeenCalledTimes(1);
  });
});
