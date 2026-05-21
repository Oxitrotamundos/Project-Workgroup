const INITIAL_ORDER = '1000.000000000000000';
const GAP = 1000;

export function firstOrder(): string {
  return INITIAL_ORDER;
}

export function between(after: string | null, before: string | null): string {
  const a = after !== null ? parseFloat(after) : 0;
  const b = before !== null ? parseFloat(before) : a + GAP * 2;

  if (b <= a) {
    throw new Error(
      `Invalid bounds: after=${after} must be < before=${before}`,
    );
  }

  const mid = (a + b) / 2;
  return mid.toFixed(15);
}

export function after(prev: string | null): string {
  const a = prev !== null ? parseFloat(prev) : 0;
  return (a + GAP).toFixed(15);
}
