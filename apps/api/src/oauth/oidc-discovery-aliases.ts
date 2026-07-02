// RFC 8414: los clientes (claude.ai) insertan el well-known entre el host y el path del issuer
// (.../oauth). oidc-provider lo sirve bajo su mount (/oauth/.well-known/...). Estos alias redirigen
// la forma path-inserted hacia la ruta real del provider, para que el discovery del connector encaje.
export function mountOidcDiscoveryAliases(expressApp: any): void {
  const alias = (from: string, to: string) =>
    expressApp.get(from, (_req: any, res: any) => res.redirect(308, to));
  alias(
    '/.well-known/oauth-authorization-server/oauth',
    '/oauth/.well-known/oauth-authorization-server',
  );
  alias(
    '/.well-known/openid-configuration/oauth',
    '/oauth/.well-known/openid-configuration',
  );
}
