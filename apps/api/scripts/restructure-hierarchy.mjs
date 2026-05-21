#!/usr/bin/env node
// Reestructura las 32 tareas planas del proyecto 6 en una jerarquía con summaries.

const API_BASE = process.env.API_BASE ?? 'https://project-workgroup.onrender.com/v1';
const TOKEN = process.env.TOKEN ?? 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ijg2OGU0YWNlMGI2NTE2ZDM2YjlmNTZkZThjZTQ5Nzg4ZmNjZGFjNDMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQW50b25pbyBCcmF2byIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS95ZWx0aWMtcHJvamVjdC13b3JrZ3JvdXAiLCJhdWQiOiJ5ZWx0aWMtcHJvamVjdC13b3JrZ3JvdXAiLCJhdXRoX3RpbWUiOjE3Nzg0MjYyMTYsInVzZXJfaWQiOiJGT3JUamJrTmZtaElGVTBBaklhV3RVZmpIcFEyIiwic3ViIjoiRk9yVGpia05mbWhJRlUwQWpJYVd0VWZqSHBRMiIsImlhdCI6MTc3ODU0MTQ0NCwiZXhwIjoxNzc4NTQ1MDQ0LCJlbWFpbCI6ImFudG9uaW9icmF2b0B5ZWx0aWMuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImFudG9uaW9icmF2b0B5ZWx0aWMuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifX0.XhAZVqwByynsH_rSTgxq4S9WfUS12gXUdJ5r6etn_G2gx21FfYgmPqslxb-fg7efzSbivzEm3qGSFk7ThRtqzIhBlQHKeM5XpA6CMDVFyF7voqKwuE5To2brg2uZMvKPsbvGvSqyAU010V0TeGFBrqNElPrAx1yMGoFQDvo9-RKU-a-WMYpH4bN9LilqhbqneI7rdMgWCgymUVJHG_Yg0ofx9RHXoSUG9QIzBf_wd48E4NiRAsk6U-WQCxfvYchgLR_yYds3GasArOcg93AfmVhHHijBVQsarlFA6ehkrt1pXnSJfcG86EQr4o-i4_LbFP83bbIqBZKmuNXNlNJL0w';

const PROJECT_ID = '6';

// Mapping conocido del run anterior: id local → id API
const LOCAL_TO_API = {
  B01: '55', B02: '56', B03: '57', B04: '58', B05: '59', B06: '60', B07: '61',
  B08: '62', B09: '63', B10: '64', B11: '65', B12: '66', B13: '67', B14: '68',
  B15: '69', B16: '70', B17: '71', B18: '72', B19: '73', B20: '74',
  B21: '75', B22: '76', B23: '77', B24: '78',
  B25: '79', B26: '80', B27: '81', B28: '82', B29: '83', B30: '84', B31: '85', B32: '86',
};

const COLORS = { DEV: '#3B82F6', UX: '#A855F7', DI: '#10B981', COM: '#F59E0B' };

// Summaries a crear. parent='KEY' refiere a otro summary; null = raíz.
const SUMMARIES = [
  { key: 'DEV',       name: 'DEV — Backend & migraciones', startDate: '2026-05-11', endDate: '2026-07-19', color: COLORS.DEV, parent: null },
  { key: 'UX',        name: 'UX — Diseño',                  startDate: '2026-05-11', endDate: '2026-06-21', color: COLORS.UX,  parent: null },
  { key: 'UX_LF',     name: 'Look & feel',                  startDate: '2026-05-11', endDate: '2026-06-07', color: COLORS.UX,  parent: 'UX' },
  { key: 'UX_CMS',    name: 'CMS UX',                       startDate: '2026-06-01', endDate: '2026-06-14', color: COLORS.UX,  parent: 'UX' },
  { key: 'DI',        name: 'DI — Contenido',               startDate: '2026-05-11', endDate: '2026-06-21', color: COLORS.DI,  parent: null },
  { key: 'DI_GUIAS',  name: 'Guías y nomenclatura',         startDate: '2026-05-11', endDate: '2026-06-14', color: COLORS.DI,  parent: 'DI' },
  { key: 'DI_ESC',    name: 'Escenarios',                   startDate: '2026-05-18', endDate: '2026-06-14', color: COLORS.DI,  parent: 'DI' },
  { key: 'COM',       name: 'COM — Comercial',              startDate: '2026-05-11', endDate: '2026-06-21', color: COLORS.COM, parent: null },
  { key: 'COM_LEADS', name: 'Leads y cierre',               startDate: '2026-05-11', endDate: '2026-06-21', color: COLORS.COM, parent: 'COM' },
  { key: 'COM_OPS',   name: 'Operación interna',            startDate: '2026-05-11', endDate: '2026-06-07', color: COLORS.COM, parent: 'COM' },
];

const PARENT_OF = {
  B01: 'DEV', B02: 'DEV', B03: 'DEV', B04: 'DEV', B05: 'DEV', B06: 'DEV', B07: 'DEV',
  B08: 'UX_LF', B09: 'UX_LF', B10: 'UX_LF', B11: 'UX_LF',
  B12: 'UX_CMS', B13: 'UX_CMS',
  B14: 'UX',
  B15: 'DI_GUIAS', B16: 'DI_GUIAS', B17: 'DI_GUIAS', B23: 'DI_GUIAS',
  B18: 'DI_ESC', B19: 'DI_ESC', B20: 'DI_ESC', B21: 'DI_ESC', B22: 'DI_ESC',
  B24: 'DI',
  B25: 'COM_LEADS', B27: 'COM_LEADS', B29: 'COM_LEADS', B31: 'COM_LEADS', B32: 'COM_LEADS',
  B26: 'COM_OPS', B28: 'COM_OPS', B30: 'COM_OPS',
};

async function api(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) { const e = new Error(`${method} ${path} → ${res.status}`); e.status = res.status; e.body = parsed; throw e; }
  return parsed;
}

async function main() {
  // 1) Crear summaries en orden topológico (padres primero)
  console.log('→ Creando summaries...');
  const summaryApi = {};
  // Ronda 1: los que tienen parent=null
  for (const s of SUMMARIES.filter(x => !x.parent)) {
    const t = await api('POST', `/projects/${PROJECT_ID}/tasks`, {
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      priority: 'medium',
      status: 'not-started',
      type: 'summary',
      color: s.color,
    });
    summaryApi[s.key] = t.id;
    console.log(`  [${s.key}] ✓ id=${t.id}`);
  }
  // Ronda 2: los anidados
  for (const s of SUMMARIES.filter(x => x.parent)) {
    const t = await api('POST', `/projects/${PROJECT_ID}/tasks`, {
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      priority: 'medium',
      status: 'not-started',
      type: 'summary',
      color: s.color,
      parentId: summaryApi[s.parent],
    });
    summaryApi[s.key] = t.id;
    console.log(`  [${s.key}] ✓ id=${t.id} (bajo ${s.parent}=${summaryApi[s.parent]})`);
  }

  // 2) Bulk PATCH: asignar parentId a cada hoja
  console.log('\n→ Bulk PATCH parentId en 32 tareas...');
  const updates = Object.entries(PARENT_OF).map(([localId, parentKey]) => ({
    id: LOCAL_TO_API[localId],
    data: { parentId: summaryApi[parentKey] },
  }));
  const result = await api('PATCH', `/projects/${PROJECT_ID}/tasks/bulk`, { updates });
  console.log(`  Bulk OK: ${result.tasks.length} tareas actualizadas · ${result.summariesPatched.length} summaries recalculados`);

  console.log('\nResumen jerárquico:');
  for (const s of SUMMARIES) {
    const children = Object.entries(PARENT_OF).filter(([_, k]) => k === s.key).map(([id]) => id);
    const subSummaries = SUMMARIES.filter(x => x.parent === s.key).map(x => x.key);
    console.log(`  ${s.parent ? '  ' : ''}[${s.key}] id=${summaryApi[s.key]} · hijos: ${[...subSummaries, ...children].join(', ') || '(vacío)'}`);
  }
}

main().catch(e => { console.error('Fatal:', e.status ?? '', e.body ?? e); process.exit(1); });
