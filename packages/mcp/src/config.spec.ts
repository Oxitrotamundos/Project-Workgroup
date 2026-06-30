import { describe, it, expect } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('returns config when both env vars are present', () => {
    const c = loadConfig({ PWG_API_URL: 'http://localhost:3000', PWG_API_KEY: 'pwg_x' } as any);
    expect(c).toEqual({ baseUrl: 'http://localhost:3000', apiKey: 'pwg_x' });
  });
  it('throws when PWG_API_URL is missing', () => {
    expect(() => loadConfig({ PWG_API_KEY: 'pwg_x' } as any)).toThrow(/PWG_API_URL/);
  });
  it('throws when PWG_API_KEY is missing', () => {
    expect(() => loadConfig({ PWG_API_URL: 'http://x' } as any)).toThrow(/PWG_API_KEY/);
  });
});
