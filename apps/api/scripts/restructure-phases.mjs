#!/usr/bin/env node
// Reestructura el proyecto 6 a fases (P1..P4) × carriles (DEV/UX/DI/COM).

const API_BASE = process.env.API_BASE ?? 'https://project-workgroup.onrender.com/v1';
const TOKEN = process.env.TOKEN ?? 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ijg2OGU0YWNlMGI2NTE2ZDM2YjlmNTZkZThjZTQ5Nzg4ZmNjZGFjNDMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQW50b25pbyBCcmF2byIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS95ZWx0aWMtcHJvamVjdC13b3JrZ3JvdXAiLCJhdWQiOiJ5ZWx0aWMtcHJvamVjdC13b3JrZ3JvdXAiLCJhdXRoX3RpbWUiOjE3Nzg0MjYyMTYsInVzZXJfaWQiOiJGT3JUamJrTmZtaElGVTBBaklhV3RVZmpIcFEyIiwic3ViIjoiRk9yVGpia05mbWhJRlUwQWpJYVd0VWZqSHBRMiIsImlhdCI6MTc3ODU0MTQ0NCwiZXhwIjoxNzc4NTQ1MDQ0LCJlbWFpbCI6ImFudG9uaW9icmF2b0B5ZWx0aWMuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImFudG9uaW9icmF2b0B5ZWx0aWMuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifX0.XhAZVqwByynsH_rSTgxq4S9WfUS12gXUdJ5r6etn_G2gx21FfYgmPqslxb-fg7efzSbivzEm3qGSFk7ThRtqzIhBlQHKeM5XpA6CMDVFyF7voqKwuE5To2brg2uZMvKPsbvGvSqyAU010V0TeGFBrqNElPrAx1yMGoFQDvo9-RKU-a-WMYpH4bN9LilqhbqneI7rdMgWCgymUVJHG_Yg0ofx9RHXoSUG9QIzBf_wd48E4NiRAsk6U-WQCxfvYchgLR_yYds3GasArOcg93AfmVhHHijBVQsarlFA6ehkrt1pXnSJfcG86EQr4o-i4_LbFP83bbIqBZKmuNXNlNJL0w';

const PROJECT_ID = '6';

// Tareas hoja ya existentes (no se borran).
const LOCAL_TO_API = {
  B01: '55', B02: '56', B03: '57', B04: '58', B05: '59', B06: '60', B07: '61',
  B08: '62', B09: '63', B10: '64', B11: '65', B12: '66', B13: '67', B14: '68',
  B15: '69', B16: '70', B17: '71', B18: '72', B19: '73', B20: '74',
  B21: '75', B22: '76', B23: '77', B24: '78',
  B25: '79', B26: '80', B27: '81', B28: '82', B29: '83', B30: '84', B31: '85', B32: '86',
};

// Summaries de la jerarquía v1 (ids 87..96) que se borrarán al final, una vez sin hijos.
const OLD_SUMMARY_IDS = ['87','88','89','90','91','92','93','94','95','96'];

const TRACK_COLOR = { DEV: '#3B82F6', UX: '#A855F7', DI: '#10B981', COM: '#F59E0B' };
const PHASE_COLOR = { P1: '#3B82F6', P2: '#10B981', P3: '#F59E0B', P4: '#A855F7' };

const PHASES = [
  { key: 'P1', name: 'Fase 1 — Cimientos y descongelamiento',
    description: 'Arrancar dev backend (F0 + bug crítico), descongelar comercial, iniciar marca, capturar leads.\n\n— WBS: 1 · Owner: Pedro · Esfuerzo: 158h · Objetivo: OBJ-3,OBJ-4,OBJ-1,OBJ-2',
    startDate: '2026-05-11', endDate: '2026-05-24', priority: 'critical' },
  { key: 'P2', name: 'Fase 2 — Migración del core + activación de contenido',
    description: 'F1 Chat migración (path crítico). Sesión guiada con Yu Ping. Avance fuerte de contenido (DI).\n\n— WBS: 2 · Owner: Pedro · Esfuerzo: 270h · Objetivo: OBJ-2,OBJ-3,OBJ-1,OBJ-4',
    startDate: '2026-05-25', endDate: '2026-06-07', priority: 'critical' },
  { key: 'P3', name: 'Fase 3 — Evaluator + cierre Yu Ping',
    description: 'F2 Dialogic + F3 Evaluator. UI de progreso. Cierre comercial Yu Ping. Cumple OBJ-3.\n\n— WBS: 3 · Owner: Pedro · Esfuerzo: 152h · Objetivo: OBJ-3,OBJ-2,OBJ-4',
    startDate: '2026-06-08', endDate: '2026-06-21', priority: 'critical' },
  { key: 'P4', name: 'Fase 4 — Cola del refactor y consolidación',
    description: 'F4/F6 (STT + GROW) y F5 (Gemini Live). Fuera de ventana Yu Ping.\n\n— WBS: 4 · Owner: Pedro · Esfuerzo: 115h · Objetivo: OBJ-3',
    startDate: '2026-06-22', endDate: '2026-07-19', priority: 'medium' },
];

const SUMMARIES = [
  { key: 'P1.DEV', parent: 'P1', track: 'DEV', name: 'P1 — DEV (backend / migración)', startDate: '2026-05-11', endDate: '2026-05-24', priority: 'critical' },
  { key: 'P1.UX',  parent: 'P1', track: 'UX',  name: 'P1 — DISEÑO UI/UX (marca + flujos)', startDate: '2026-05-11', endDate: '2026-05-24', priority: 'critical' },
  { key: 'P1.DI',  parent: 'P1', track: 'DI',  name: 'P1 — DI / CONTENIDO', startDate: '2026-05-11', endDate: '2026-05-24', priority: 'critical' },
  { key: 'P1.COM', parent: 'P1', track: 'COM', name: 'P1 — COMERCIAL / EJECUTIVO', startDate: '2026-05-11', endDate: '2026-05-24', priority: 'critical' },
  { key: 'P2.DEV', parent: 'P2', track: 'DEV', name: 'P2 — DEV (backend / migración)', startDate: '2026-05-25', endDate: '2026-06-14', priority: 'critical' },
  { key: 'P2.UX',  parent: 'P2', track: 'UX',  name: 'P2 — DISEÑO UI/UX (marca + flujos)', startDate: '2026-05-25', endDate: '2026-06-14', priority: 'critical' },
  { key: 'P2.DI',  parent: 'P2', track: 'DI',  name: 'P2 — DI / CONTENIDO', startDate: '2026-05-25', endDate: '2026-06-14', priority: 'critical' },
  { key: 'P2.COM', parent: 'P2', track: 'COM', name: 'P2 — COMERCIAL / EJECUTIVO', startDate: '2026-05-25', endDate: '2026-06-07', priority: 'critical' },
  { key: 'P3.DEV', parent: 'P3', track: 'DEV', name: 'P3 — DEV (backend / migración)', startDate: '2026-06-08', endDate: '2026-06-28', priority: 'high' },
  { key: 'P3.UX',  parent: 'P3', track: 'UX',  name: 'P3 — DISEÑO UI/UX (marca + flujos)', startDate: '2026-06-08', endDate: '2026-06-21', priority: 'high' },
  { key: 'P3.DI',  parent: 'P3', track: 'DI',  name: 'P3 — DI / CONTENIDO', startDate: '2026-06-08', endDate: '2026-06-21', priority: 'high' },
  { key: 'P3.COM', parent: 'P3', track: 'COM', name: 'P3 — COMERCIAL / EJECUTIVO', startDate: '2026-06-08', endDate: '2026-06-21', priority: 'critical' },
  { key: 'P4.DEV', parent: 'P4', track: 'DEV', name: 'P4 — DEV (backend / migración)', startDate: '2026-06-29', endDate: '2026-07-19', priority: 'medium' },
];

// Mapa hoja → nuevo summary (según WBS del CSV).
const LEAF_PARENT = {
  B01: 'P1.DEV', B02: 'P1.DEV',
  B03: 'P2.DEV',
  B04: 'P3.DEV', B05: 'P3.DEV',
  B06: 'P4.DEV', B07: 'P4.DEV',
  B08: 'P1.UX',  B09: 'P1.UX',
  B10: 'P2.UX',  B11: 'P2.UX', B12: 'P2.UX', B13: 'P2.UX',
  B14: 'P3.UX',
  B15: 'P1.DI',  B16: 'P1.DI', B17: 'P1.DI', B20: 'P1.DI',
  B18: 'P2.DI',  B19: 'P2.DI', B21: 'P2.DI', B22: 'P2.DI',
  B23: 'P3.DI',  B24: 'P3.DI',
  B25: 'P1.COM', B26: 'P1.COM', B27: 'P1.COM', B28: 'P1.COM',
  B29: 'P2.COM', B30: 'P2.COM', B32: 'P2.COM',
  B31: 'P3.COM',
};

// Descripciones limpias + metadata (sin el sufijo "ID local"; el nombre ya identifica).
// Se basan en el CSV v2 que envió el usuario.
const LEAF = {
  B01: { wbs: '1.1.1', track: 'DEV', owner: 'Antonio', eff: '8',  obj: 'OBJ-3',         deps: '',         desc: 'En la demo del 6 Pedro vio que al cerrar sin cumplir el objetivo aparecía felicitación. Bug de lógica de cierre. Rompe credibilidad del feedback.' },
  B02: { wbs: '1.1.2', track: 'DEV', owner: 'Antonio', eff: '60', obj: 'OBJ-4',         deps: 'Decisión hosting + Postgres provider', desc: 'Postgres + schema + auth/AppCheck/CORS + llmApiClient skeleton + dashboards básicos. Prerequisito de todas las demás fases.' },
  B03: { wbs: '2.1.1', track: 'DEV', owner: 'Antonio', eff: '90', obj: 'OBJ-2,OBJ-3',   deps: 'B02',      desc: '/api/llm/chat con 5 capas de safety embebidas, rate limits, billing. Camino crítico de la app.' },
  B04: { wbs: '3.1.1', track: 'DEV', owner: 'Antonio', eff: '20', obj: 'OBJ-3',         deps: 'B03',      desc: '/api/dialogic/classify con caching por hash(message+context). Restaura badges de movimientos dialógicos en /chat.' },
  B05: { wbs: '3.1.2', track: 'DEV', owner: 'Antonio', eff: '80', obj: 'OBJ-3',         deps: 'B03,B11',  desc: '/api/evaluator/assess. Agente nuevo out-of-character. Evalúa progreso del usuario. Cubre formativa + sumativa + reporte exportable.' },
  B06: { wbs: '4.1.1', track: 'DEV', owner: 'Antonio', eff: '15', obj: '',              deps: 'B03',      desc: 'F4: migrar Whisper de Cloud Function al nuevo backend (opcional). F6: /api/grow/message (devtool).' },
  B07: { wbs: '4.1.2', track: 'DEV', owner: 'Antonio', eff: '100',obj: 'OBJ-3',         deps: 'B03,B04,B05,CMS 6 campos live*', desc: 'WebSocket bidireccional + audio bridge + analyzers async. Infra distinta. Fuera de ventana Yu Ping.' },
  B08: { wbs: '1.2.1', track: 'UX',  owner: 'Dani',    eff: '4',  obj: 'OBJ-1',         deps: 'Briefing entregado', desc: 'A partir del documento proporcionado, analizar si se tiene la info para generar propuesta de look & feel.' },
  B09: { wbs: '1.2.2', track: 'UX',  owner: 'Dani',    eff: '24', obj: 'OBJ-1',         deps: 'B08 aprobado', desc: 'Benchmarking, paleta de color, logotipo, tipografía.' },
  B10: { wbs: '2.2.1', track: 'UX',  owner: 'Dani',    eff: '8',  obj: 'OBJ-1',         deps: 'B09',      desc: 'Revisión de propuesta para verificar accesibilidad, usabilidad, contraste. Aplicar cambios si requiere.' },
  B11: { wbs: '2.2.2', track: 'UX',  owner: 'Dani',    eff: '12', obj: 'OBJ-1,OBJ-2',   deps: 'B10 aprobado', desc: 'Aplicar guidelines a flujos activos e iteraciones a desarrollar.' },
  B12: { wbs: '2.2.3', track: 'UX',  owner: 'Dani',    eff: '4',  obj: 'OBJ-2,OBJ-4',   deps: '',         desc: 'Mapear alcance, permisos, flujo, roles y dinámica de funcionamiento del CMS.' },
  B13: { wbs: '2.2.4', track: 'UX',  owner: 'Dani',    eff: '12', obj: 'OBJ-2,OBJ-4',   deps: 'B12',      desc: 'A partir del mapeo, integrar/diseñar los cambios al flujo UX del CMS.' },
  B14: { wbs: '3.2.1', track: 'UX',  owner: 'Dani',    eff: '16', obj: 'OBJ-3',         deps: 'B05',      desc: 'Diseñar componentes que muestran el reporte del evaluator: panel lateral / badges / modal final. Decisión de UX pendiente.' },
  B15: { wbs: '1.3.1', track: 'DI',  owner: 'Dafne',   eff: '12', obj: 'OBJ-1',         deps: 'Estudio comercial', desc: 'Documento con descripción de la plataforma y pautas para look & feel y branding del producto.' },
  B16: { wbs: '1.3.2', track: 'DI',  owner: 'Dafne',   eff: '12', obj: 'OBJ-2',         deps: '',         desc: 'Documenta el proceso editorial para creación de contenidos y validación de agentes conversacionales anclados a las experiencias.' },
  B17: { wbs: '1.3.3', track: 'DI',  owner: 'Dafne',   eff: '8',  obj: 'OBJ-4',         deps: '',         desc: 'Revisar y afinar la nomenclatura propuesta para las categorías de configuración del gestor de contenidos.' },
  B18: { wbs: '2.3.1', track: 'DI',  owner: 'Dafne',   eff: '8',  obj: 'OBJ-2',         deps: '',         desc: 'Análisis de la experiencia del flujo de instructor.' },
  B19: { wbs: '2.3.2', track: 'DI',  owner: 'Dafne',   eff: '16', obj: 'OBJ-3',         deps: 'Decisión rúbricas', desc: 'Complementar el DI de evaluación post práctica y documentar en guía operativa. Alimenta directo a F3 (Evaluator).' },
  B20: { wbs: '1.3.4', track: 'DI',  owner: 'Dafne',   eff: '8',  obj: 'OBJ-2',         deps: '',         desc: 'Se completa el último escenario pendiente de elaboración de contenidos del catálogo.' },
  B21: { wbs: '2.3.3', track: 'DI',  owner: 'Dafne',   eff: '54', obj: 'OBJ-2',         deps: '',         desc: 'Revisar congruencia, completud y cumplimiento de criterios de fase editorial. 3h por escenario × 18 = 54h.' },
  B22: { wbs: '2.3.4', track: 'DI',  owner: 'Dafne',   eff: '40', obj: 'OBJ-2',         deps: 'B21',      desc: 'Capturar escenarios validados en la plataforma. 2h por escenario × 20 = 40h.' },
  B23: { wbs: '3.3.1', track: 'DI',  owner: 'Dafne',   eff: '12', obj: 'OBJ-2,OBJ-4',   deps: 'B17',      desc: 'Guía de especificaciones para llenado del gestor, dirigida a usuarios externos (admins de empresa).' },
  B24: { wbs: '3.3.2', track: 'DI',  owner: 'Dafne',   eff: '16', obj: 'OBJ-3',         deps: 'B03',      desc: 'Ejecución y validación de pruebas de chat post migración F1.' },
  B25: { wbs: '1.4.1', track: 'COM', owner: 'Dafne+Ángel', eff: '4', obj: 'OBJ-4',      deps: 'Disponibilidad Ángel', desc: 'Con Ángel: nombre real del cliente, decisor, contacto directo, ciclo de decisión, presupuesto si se deja. Antes de que se enfríe.' },
  B26: { wbs: '1.4.2', track: 'COM', owner: 'Pedro+Bruno', eff: '8', obj: 'OBJ-4',      deps: '',         desc: 'Hosting, Postgres, rate limits, cuotas, multi-tenant cost imputation, etc. Bloquea silenciosamente al dev.' },
  B27: { wbs: '1.4.3', track: 'COM', owner: 'Pedro',   eff: '2',  obj: 'OBJ-4',         deps: '',         desc: 'Comunicar el upgrade de arquitectura como propuesta de valor reforzada, no como retraso.' },
  B28: { wbs: '1.4.4', track: 'COM', owner: 'Comercial', eff: '8', obj: 'OBJ-1',        deps: '',         desc: 'Para alimentar el brief de marca con factores diferenciadores (paleta, posicionamiento, competidores).' },
  B29: { wbs: '2.4.1', track: 'COM', owner: 'Dafne+Antonio', eff: '6', obj: 'OBJ-2',    deps: 'B03 estable + escenarios cargados', desc: 'Sesión en vivo donde ella crea su primer escenario con apoyo de Dafne + Antonio. Mantiene el lead caliente.' },
  B30: { wbs: '2.4.2', track: 'COM', owner: 'Pedro+Bruno', eff: '16', obj: 'OBJ-4',     deps: 'Decisión modelo comercial Yu Ping (cerrada: cliente)', desc: 'Definir modelo de pricing (por seat / por org / por scenario) y plantilla de contrato.' },
  B31: { wbs: '3.4.1', track: 'COM', owner: 'Pedro',   eff: '8',  obj: 'OBJ-4',         deps: 'B29,B30',  desc: 'Conversación final post sesión guiada: contrato o piloto pagado.' },
  B32: { wbs: '2.4.3', track: 'COM', owner: 'Ángel+Pedro', eff: '4', obj: 'OBJ-4',      deps: 'B25',      desc: 'Ya no demo: propuesta de piloto pagado con respuesta directa a sus 3 dolores (complejo/lento/caro).' },
};

function buildLeafDescription(local) {
  const r = LEAF[local];
  const meta = [
    `WBS: ${r.wbs}`,
    `Owner: ${r.owner}`,
    `Track: ${r.track}`,
    r.obj ? `Objetivo: ${r.obj}` : null,
    `Esfuerzo: ${r.eff}h`,
    r.deps ? `Depende de: ${r.deps}` : null,
    `ID local: ${local}`,
  ].filter(Boolean).join(' · ');
  return `${r.desc}\n\n— ${meta}`;
}

async function api(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let parsed; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) { const e = new Error(`${method} ${path} → ${res.status}`); e.status = res.status; e.body = parsed; throw e; }
  return parsed;
}

async function main() {
  const apiOf = {}; // key → API id

  console.log('→ Creando 4 fases...');
  for (const p of PHASES) {
    const t = await api('POST', `/projects/${PROJECT_ID}/tasks`, {
      name: p.name,
      description: p.description,
      startDate: p.startDate,
      endDate: p.endDate,
      priority: p.priority,
      status: 'not-started',
      type: 'summary',
      color: PHASE_COLOR[p.key],
    });
    apiOf[p.key] = t.id;
    console.log(`  [${p.key}] ✓ id=${t.id}`);
  }

  console.log('\n→ Creando 13 sub-summaries...');
  for (const s of SUMMARIES) {
    const t = await api('POST', `/projects/${PROJECT_ID}/tasks`, {
      name: s.name,
      description: `Carril ${s.track} dentro de la ${s.parent === 'P1' ? 'Fase 1' : s.parent === 'P2' ? 'Fase 2' : s.parent === 'P3' ? 'Fase 3' : 'Fase 4'}.`,
      startDate: s.startDate,
      endDate: s.endDate,
      priority: s.priority,
      status: 'not-started',
      type: 'summary',
      color: TRACK_COLOR[s.track],
      parentId: apiOf[s.parent],
    });
    apiOf[s.key] = t.id;
    console.log(`  [${s.key}] ✓ id=${t.id} (parent=${s.parent})`);
  }

  console.log('\n→ Bulk PATCH parentId + descripción en 32 tareas hoja...');
  const updates = Object.entries(LEAF_PARENT).map(([local, parentKey]) => ({
    id: LOCAL_TO_API[local],
    data: {
      parentId: apiOf[parentKey],
      description: buildLeafDescription(local),
    },
  }));
  const result = await api('PATCH', `/projects/${PROJECT_ID}/tasks/bulk`, { updates });
  console.log(`  Bulk OK: ${result.tasks.length} hojas · ${result.summariesPatched.length} summaries recalculados`);

  console.log('\n→ Borrando 10 summaries de la jerarquía v1 (sin hijos)...');
  for (const id of OLD_SUMMARY_IDS) {
    try {
      await api('DELETE', `/tasks/${id}`);
      console.log(`  delete id=${id} ✓`);
    } catch (e) {
      console.error(`  delete id=${id} ✗ ${e.status}`, e.body);
    }
  }

  console.log('\nMapeo de nuevos summaries:');
  for (const k of Object.keys(apiOf)) console.log(`  ${k.padEnd(8)} → id=${apiOf[k]}`);
}

main().catch(e => { console.error('Fatal:', e.status ?? '', e.body ?? e); process.exit(1); });
