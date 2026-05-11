import { ConflictException, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
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
  },
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
    expect(prisma.idempotencyKey.findUnique).not.toHaveBeenCalled();
  });

  it('returns cached response when key matches with same body hash', async () => {
    const prisma = makePrisma();
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: 'sha-abc',
      responseStatus: 201,
      responseBody: { id: 'cached' },
    });

    const interceptor = new IdempotencyInterceptor(prisma as any);
    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'POST',
      url: '/v1/projects/1/tasks',
      user: { id: 1n },
      body: { name: 'A' },
    });
    (interceptor as any).hashRequest = () => 'sha-abc';

    const result$ = await interceptor.intercept(ctx, {
      handle: () => of({ id: 'fresh' }),
    } as any);
    await expect(firstValueFrom(result$)).resolves.toEqual({ id: 'cached' });
  });

  it('throws ConflictException when key is reused with different body', async () => {
    const prisma = makePrisma();
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: 'sha-old',
      responseStatus: 201,
      responseBody: {},
    });

    const interceptor = new IdempotencyInterceptor(prisma as any);
    (interceptor as any).hashRequest = () => 'sha-new';

    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'POST',
      url: '/v1/projects/1/tasks',
      user: { id: 1n },
      body: { name: 'B' },
    });

    await expect(
      interceptor.intercept(ctx, { handle: () => of('x') } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('persists response after handler completes when no prior key exists', async () => {
    const prisma = makePrisma();
    prisma.idempotencyKey.findUnique.mockResolvedValue(null);
    prisma.idempotencyKey.create.mockResolvedValue({});

    const interceptor = new IdempotencyInterceptor(prisma as any);
    (interceptor as any).hashRequest = () => 'sha-new';

    const ctx = makeContext({
      headers: { 'idempotency-key': 'k1' },
      method: 'POST',
      url: '/v1/projects/1/tasks',
      user: { id: 1n },
      body: { name: 'C' },
    });

    const result$ = await interceptor.intercept(ctx, {
      handle: () => of({ id: '42' }),
    } as any);
    await firstValueFrom(result$);

    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'k1',
          userId: 1n,
          requestHash: 'sha-new',
          responseBody: { id: '42' },
        }),
      }),
    );
  });
});
