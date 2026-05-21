import { firstOrder, between, after } from './fractional-index';

describe('fractional-index', () => {
  it('firstOrder returns a positive value', () => {
    expect(parseFloat(firstOrder())).toBeGreaterThan(0);
  });

  it('between returns a value strictly between two orders', () => {
    const a = '1000.000000000000000';
    const b = '2000.000000000000000';
    const mid = between(a, b);
    expect(parseFloat(mid)).toBeGreaterThan(parseFloat(a));
    expect(parseFloat(mid)).toBeLessThan(parseFloat(b));
  });

  it('between with null lower bound returns value less than upper', () => {
    const b = '500.000000000000000';
    const result = between(null, b);
    expect(parseFloat(result)).toBeLessThan(parseFloat(b));
  });

  it('between with null upper bound returns value greater than lower', () => {
    const a = '1000.000000000000000';
    const result = between(a, null);
    expect(parseFloat(result)).toBeGreaterThan(parseFloat(a));
  });

  it('after returns a value greater than prev', () => {
    const prev = '1000.000000000000000';
    const result = after(prev);
    expect(parseFloat(result)).toBeGreaterThan(parseFloat(prev));
  });

  it('after with null prev returns positive value', () => {
    const result = after(null);
    expect(parseFloat(result)).toBeGreaterThan(0);
  });

  it('produces strictly increasing orders for sequential inserts', () => {
    const orders: string[] = [];
    orders.push(firstOrder());
    orders.push(after(orders[orders.length - 1]));
    orders.push(after(orders[orders.length - 1]));
    for (let i = 1; i < orders.length; i++) {
      expect(parseFloat(orders[i])).toBeGreaterThan(parseFloat(orders[i - 1]));
    }
  });
});
