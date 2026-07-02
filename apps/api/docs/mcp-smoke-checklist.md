# MCP remote smoke-test checklist (Phase 4c)

Cómo conectar el servidor MCP (`POST /mcp`) como custom connector desde claude.ai,
de punta a punta: deploy → cadena de discovery → OAuth (login Firebase) → tools.

`<host>` = el host público del deploy (p. ej. `project-workgroup.onrender.com`).

---

## 0. Prerequisites

### Env (todas requeridas para habilitar el AS + RS)

| Var | Valor | Nota |
|-----|-------|------|
| `MCP_OAUTH_ISSUER` | `https://<host>/oauth` | base del AS (con path `/oauth`, que es donde se monta oidc-provider) |
| `MCP_OAUTH_AUDIENCE` | `https://<host>` | **el origin del API** — el `AuthGuard` arma la URL de la PRM como `{AUDIENCE}/.well-known/oauth-protected-resource`, servida por `OAuthMetadataController` en la raíz; si `AUDIENCE` lleva un path, esa URL no resuelve |
| `MCP_OAUTH_SIGNING_JWKS` | `{ "keys": [ <RSA priv> ] }` | **secreto**; firma los JWT |
| `MCP_OAUTH_JWKS` | `{ "keys": [ <RSA pub> ] }` | público; el RS valida contra él (en memoria) |
| `MCP_OAUTH_COOKIE_KEYS` | `k1,k2` | secretos de cookies de sesión/interacción (coma-separados) |
| `MCP_OAUTH_FIREBASE_WEB_CONFIG` | `{ ... }` | config web de Firebase para la página de login |
| `MCP_OAUTH_ALLOWED_CLIENT_HOSTS` | `claude.ai,claude.com` | allow-list CIMD (gate SSRF + trust) |
| `MCP_SELF_BASE_URL` | `http://127.0.0.1:<PORT>` | loopback del MCP a `/v1` (default si se omite) |

> El AS solo se monta si `MCP_OAUTH_ISSUER` + `MCP_OAUTH_AUDIENCE` + `MCP_OAUTH_SIGNING_JWKS`
> están presentes (ver `main.ts`). Sin las tres, `/oauth/*` no existe.

### Fiabilidad — Render NO debe hibernar (diseño §6, requisito, no nota)

El handshake OAuth toca `/authorize` y `/token` en cold-start (~12 s medido; el timeout de
30 s del lado de Claude ya se disparó una vez). En cold-start el connector **no conecta**.
Resolver antes del smoke: keep-warm ping (cron externo a `/v1/health` cada ~5 min) **o** tier
pago sin hibernación.

### Compliance (diseño §7, bloqueante)

En modo remoto el dato de proyectos/tareas **pasa por la nube de Anthropic**. Confirmar la
política de datos del tier de la cuenta ANTES del smoke (Team/Enterprise no entrenan; revisar
Free/Pro). Mantener la disciplina de no-PII.

---

## 1. Verificar la cadena de discovery por curl (ANTES de claude.ai)

**Hop 1 — 401 + puntero a la PRM (RFC 9728):**
```bash
curl -i -X POST https://<host>/mcp \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
# → HTTP/1.1 401
#   www-authenticate: Bearer resource_metadata="https://<host>/.well-known/oauth-protected-resource"
```

**Hop 2 — Protected Resource Metadata:**
```bash
curl https://<host>/.well-known/oauth-protected-resource
# → { "resource": "https://<host>", "authorization_servers": ["https://<host>/oauth"] }
```

**Hop 3 — Authorization Server Metadata (el hop sensible a la alineación):**

oidc-provider 9.8.6 sirve AMBAS, pero **relativas a su mount** (`/oauth`):
```bash
curl https://<host>/oauth/.well-known/oauth-authorization-server   # ✔ sirve
curl https://<host>/oauth/.well-known/openid-configuration          # ✔ sirve
```
Confirmar en el JSON: `issuer: "https://<host>/oauth"`, `code_challenge_methods_supported: ["S256"]`,
`authorization_endpoint`, `token_endpoint`, `jwks_uri`.

La forma **RFC 8414 path-inserted** que algunos clientes piden primero (oidc-provider NO la sirve):
```bash
curl -i https://<host>/.well-known/oauth-authorization-server/oauth   # probablemente 404
```

---

## 2. Punto de alineación predicho + fix listo

Si claude.ai reporta que **no encuentra la metadata del AS**, está pidiendo la URL RFC 8414
*path-inserted* `https://<host>/.well-known/oauth-authorization-server/oauth` (y/o la variante
OIDC `.../.well-known/openid-configuration/oauth`), que oidc-provider no sirve bajo la raíz.

**Fix (aplicar SOLO si el smoke lo revela):** alias en `main.ts`, registrado en el Express crudo
ANTES del mount del provider, hacia la ruta que oidc-provider sí sirve bajo `/oauth`:

```ts
const httpInstance = app.getHttpAdapter().getInstance();
// RFC 8414: el cliente inserta el well-known entre host y el path del issuer (.../oauth).
// oidc-provider lo sirve bajo su mount (/oauth/.well-known/...): redirigimos hacia ahí.
httpInstance.get('/.well-known/oauth-authorization-server/oauth', (_req, res) =>
  res.redirect(308, '/oauth/.well-known/oauth-authorization-server'),
);
httpInstance.get('/.well-known/openid-configuration/oauth', (_req, res) =>
  res.redirect(308, '/oauth/.well-known/openid-configuration'),
);
```

- `308` preserva el método y es cacheable; un `302` también sirve para GET.
- Si el cliente no sigue redirects de discovery, servir el JSON directamente (fetch interno a la
  ruta del provider y responder el cuerpo) en vez de redirigir.
- Commit sugerido: `fix(api): alias the rfc 8414 well-known to the oidc-provider discovery`.

**Segundo punto posible (menos probable):** si claude.ai exige que el `resource` de la PRM sea la
URL exacta del MCP (`https://<host>/mcp`) en vez del origin, servir la PRM path-based en
`/.well-known/oauth-protected-resource/mcp` y poner `MCP_OAUTH_AUDIENCE=https://<host>/mcp`
(el `aud` del token seguiría validando, porque el `AuthGuard` compara contra `AUDIENCE`). Documentar
si hizo falta.

---

## 3. Conectar el connector en claude.ai

Añadir un custom connector con la URL `https://<host>/mcp`. Flujo esperado:

1. `POST /mcp` sin token → **401** + `WWW-Authenticate` (hop 1).
2. claude.ai lee la **PRM** → obtiene el `authorization_servers` (hop 2).
3. claude.ai lee la **AS metadata** (hop 3; aquí actúa el alias si hizo falta).
4. **CIMD:** claude.ai usa su `client_id` (una URL https); la allow-list debe aceptar `claude.ai`.
5. `/authorize` → **página de login Firebase** (Google) → consent (auto) → `/token` → **JWT**.
6. claude.ai reintenta `POST /mcp` con el `Bearer` → **lista de tools**.

---

## 4. Validar en el chat

Con el connector conectado:

- [ ] `list_projects` → devuelve tus proyectos reales.
- [ ] `get_project_overview` → funciona.
- [ ] Una escritura (`create_task` en un proyecto desechable) → aplica.
- [ ] Anotar qué tools aparecieron y el resultado de cada una.

> Recordatorio de la postura A: un token `via:'oauth'` NO puede borrar por el API directo
> (`DELETE` → 403). Las tools de escritura no destructivas sí operan.

---

## 5. Registro del smoke

Anotar, por hop: qué pasó, qué alineación de discovery hizo falta (con la URL exacta que pidió
claude.ai), y cualquier fix de código con su commit. Pegarlo aquí o en el ledger
(`.superpowers/sdd/progress.md`).

| Hop | Resultado | Nota |
|-----|-----------|------|
| 1. 401 + WWW-Authenticate | ⬜ | |
| 2. PRM | ⬜ | |
| 3. AS metadata | ⬜ | ¿alias RFC 8414 necesario? |
| 4. CIMD (client_id claude.ai) | ⬜ | |
| 5. login Firebase → token | ⬜ | |
| 6. tools list en /mcp | ⬜ | |
| 7. list_projects / overview / create_task | ⬜ | |
