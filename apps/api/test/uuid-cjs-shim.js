// Shim SOLO de test. uuid@14 es ESM puro (sin build CJS); bajo --experimental-vm-modules
// (necesario para cargar el AS oidc-provider, ESM-only), Jest rechaza el `require("uuid")` que hace
// dockerode. testcontainers solo usa `uuid.v4` para ids de sesión, así que basta con respaldar la
// API en node:crypto. No toca producción: solo se mapea aquí vía moduleNameMapper del jest-e2e.
const { randomUUID } = require('node:crypto');

const NIL = '00000000-0000-0000-0000-000000000000';
const MAX = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const v4 = () => randomUUID();
const validate = (s) =>
  typeof s === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const version = (s) => parseInt(String(s).slice(14, 15), 16);
const parse = (s) => Uint8Array.from(Buffer.from(String(s).replace(/-/g, ''), 'hex'));
const stringify = (b) => {
  const h = Buffer.from(b).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

// v1/v3/v5/v6/v7 no los usa la cadena de testcontainers; se mapean a v4 por si algún consumidor los pide.
const api = {
  v1: v4,
  v3: v4,
  v4,
  v5: v4,
  v6: v4,
  v7: v4,
  NIL,
  MAX,
  validate,
  version,
  parse,
  stringify,
};

module.exports = { ...api, default: api };
