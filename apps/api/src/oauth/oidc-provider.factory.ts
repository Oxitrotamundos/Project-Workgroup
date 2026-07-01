import type { PrismaService } from '../prisma/prisma.service';
import { PrismaOidcAdapter } from './prisma-oidc-adapter';

export interface OidcProviderOpts {
  issuer: string;
  audience: string;
  prisma: PrismaService;
  signingJwks: { keys: unknown[] };
}

// node-oidc-provider es ESM-only y no trae tipos: se carga con un import() dinámico real.
// El especificador opaco evita que tsc (module:commonjs) lo degrade a require() y esquiva TS7016.
const importESM = new Function('s', 'return import(s)') as (
  s: string,
) => Promise<any>;

export async function createOidcProvider(opts: OidcProviderOpts) {
  const { default: Provider } = await importESM('oidc-provider');

  const provider = new Provider(opts.issuer, {
    adapter: (name: string) => new PrismaOidcAdapter(name, opts.prisma),
    jwks: opts.signingJwks,
    // Cliente ESTÁTICO de prueba (se reemplaza por CIMD en 4b-ii).
    clients: [
      {
        client_id: 'mcp-test-client',
        token_endpoint_auth_method: 'none',
        // Solo authorization_code en 4b-i: el grant refresh_token requiere habilitar offline_access
        // o issueRefreshToken en el provider, y la rotación/poda de refresh está diferida a 4b-ii.
        grant_types: ['authorization_code'],
        response_types: ['code'],
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      },
    ],
    // Claves de firma de cookies (sesión/interacción); andamiaje del spike, se rota en 4b-ii.
    cookies: { keys: ['dev-spike-key'] },
    pkce: { required: () => true },
    features: {
      devInteractions: { enabled: false },
      resourceIndicators: {
        enabled: true,
        defaultResource: () => opts.audience,
        getResourceServerInfo: () => ({
          scope: 'mcp:read mcp:write',
          audience: opts.audience,
          accessTokenFormat: 'jwt',
          jwt: { sign: { alg: 'RS256' } },
        }),
        useGrantedResource: () => true,
      },
    },
    // Interacción STUB para el spike: auto-resuelve a un accountId fijo (se reemplaza por Firebase en 4b-ii).
    async findAccount(_ctx: any, id: string) {
      return { accountId: id, claims: async () => ({ sub: id }) };
    },
    interactions: {
      url: (_ctx: any, interaction: any) =>
        `/oauth/interaction/${interaction.uid}`,
    },
    scopes: ['openid', 'mcp:read', 'mcp:write'],
  });

  provider.proxy = true; // detrás del proxy de Render (x-forwarded-*)
  return provider;
}
