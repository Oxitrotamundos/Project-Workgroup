import { lastValueFrom, of } from 'rxjs';
import { BigIntSerializerInterceptor } from './bigint-serializer.interceptor';

describe('BigIntSerializerInterceptor', () => {
  it('converts bigint fields to strings recursively', async () => {
    const interceptor = new BigIntSerializerInterceptor();
    const ctx = {} as any;
    const handler = { handle: () => of({ id: 10n, nested: { id: 20n, arr: [{ id: 30n }] } }) };
    const result = await lastValueFrom(interceptor.intercept(ctx, handler));
    expect(result).toEqual({ id: '10', nested: { id: '20', arr: [{ id: '30' }] } });
  });
});
