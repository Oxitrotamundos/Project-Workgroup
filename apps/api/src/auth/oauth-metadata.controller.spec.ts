import { OAuthMetadataController } from './oauth-metadata.controller';

describe('OAuthMetadataController', () => {
  it('returns the resource + authorization_servers from config', () => {
    const config = {
      get: (k: string) =>
        (
          ({
            MCP_OAUTH_AUDIENCE: 'https://rs.test',
            MCP_OAUTH_ISSUER: 'https://as.test',
          }) as Record<string, string>
        )[k],
    };
    const c = new OAuthMetadataController(config as any);
    expect(c.protectedResource()).toEqual({
      resource: 'https://rs.test',
      authorization_servers: ['https://as.test'],
    });
  });

  it('returns an empty authorization_servers when issuer is unset', () => {
    const c = new OAuthMetadataController({ get: () => undefined } as any);
    expect(c.protectedResource()).toEqual({
      resource: undefined,
      authorization_servers: [],
    });
  });
});
