import { isAllowedClientId } from './client-allowlist';

const HOSTS = ['claude.ai', 'claude.com'];

describe('isAllowedClientId', () => {
  it('accepts an https client_id on an allowed host', () => {
    expect(
      isAllowedClientId('https://claude.ai/oauth/mcp-client-metadata', HOSTS),
    ).toBe(true);
    expect(isAllowedClientId('https://claude.com/x', HOSTS)).toBe(true);
  });
  it('rejects subdomain/suffix spoofing (exact hostname only)', () => {
    expect(isAllowedClientId('https://claude.ai.evil.com/x', HOSTS)).toBe(
      false,
    );
    expect(isAllowedClientId('https://evil.com/claude.ai', HOSTS)).toBe(false);
    expect(isAllowedClientId('https://notclaude.ai/x', HOSTS)).toBe(false);
  });
  it('rejects non-https and malformed urls', () => {
    expect(isAllowedClientId('http://claude.ai/x', HOSTS)).toBe(false);
    expect(isAllowedClientId('claude.ai', HOSTS)).toBe(false);
    expect(isAllowedClientId('not a url', HOSTS)).toBe(false);
  });
});
