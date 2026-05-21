#!/usr/bin/env node
// Bulk uploader for the KTP Roadmap May-Jul 2026 backlog.
// Usage: TOKEN="<firebase id token>" node apps/api/scripts/seed-from-csv.mjs

const API_BASE = process.env.API_BASE ?? 'https://project-workgroup.onrender.com/v1';
const TOKEN =
  process.env.TOKEN ??
  'eyJhbGciOiJSUzI1NiIsImtpZCI6Ijg2OGU0YWNlMGI2NTE2ZDM2YjlmNTZkZThjZTQ5Nzg4ZmNjZGFjNDMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQW50b25pbyBCcmF2byIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS95ZWx0aWMtcHJvamVjdC13b3JrZ3JvdXAiLCJhdWQiOiJ5ZWx0aWMtcHJvamVjdC13b3JrZ3JvdXAiLCJhdXRoX3RpbWUiOjE3Nzg0MjYyMTYsInVzZXJfaWQiOiJGT3JUamJrTmZtaElGVTBBaklhV3RVZmpIcFEyIiwic3ViIjoiRk9yVGpia05mbWhJRlUwQWpJYVd0VWZqSHBRMiIsImlhdCI6MTc3ODU0MTQ0NCwiZXhwIjoxNzc4NTQ1MDQ0LCJlbWFpbCI6ImFudG9uaW9icmF2b0B5ZWx0aWMuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImFudG9uaW9icmF2b0B5ZWx0aWMuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifX0.XhAZVqwByynsH_rSTgxq4S9WfUS12gXUdJ5r6etn_G2gx21FfYgmPqslxb-fg7efzSbivzEm3qGSFk7ThRtqzIhBlQHKeM5XpA6CMDVFyF7voqKwuE5To2brg2uZMvKPsbvGvSqyAU010V0TeGFBrqNElPrAx1yMGoFQDvo9-RKU-a-WMYpH4bN9LilqhbqneI7rdMgWCgymUVJHG_Yg0ofx9RHXoSUG9QIzBf_wd48E4NiRAsk6U-WQCxfvYchgLR_yYds3GasArOcg93AfmVhHHijBVQsarlFA6ehkrt1pXnSJfcG86EQr4o-i4_LbFP83bbIqBZKmuNXNlNJL0w';

const ANTONIO_USER_ID = '1';

const TRACK_COLORS = {
  DEV: '#3B82F6',
  UX: '#A855F7',
  DI: '#10B981',
  COM: '#F59E0B',
};

const PRIORITY_MAP = { P0: 'critical', P1: 'high', P2: 'medium', P3: 'low' };

const PROJECT_PAYLOAD = {
  name: 'KTP Roadmap May-Jul 2026',
  description: 'Carga inicial del backlog B01–B32 (mayo–julio 2026).',
  startDate: '2026-05-11',
  endDate: '2026-07-19',
  status: 'active',
  color: '#3B82F6',
};

// id, title, description, track, owner, effort_hours, objective, dependencies, priority, start_date, end_date, status
const ROWS = [
  ['B01', 'Fix bug cierre falso de objetivo', 'En la demo del 6 Pedro vio que al cerrar sin cumplir el objetivo aparecía felicitación. Bug de lógica de cierre. Rompe credibilidad del feedback.', 'DEV', 'Antonio', '8', 'OBJ-3', '', 'P0', '2026-05-11', '2026-05-17', 'todo'],
  ['B02', 'F0 — Foundation backend', 'Postgres + schema + auth/AppCheck/CORS + llmApiClient skeleton + dashboards básicos. Prerequisito de todas las demás fases.', 'DEV', 'Antonio', '60', 'OBJ-4', 'Decisión hosting + Postgres provider', 'P0', '2026-05-11', '2026-05-24', 'todo'],
  ['B03', 'F1 — Chat migration (P0)', '/api/llm/chat con 5 capas de safety embebidas, rate limits, billing. Camino crítico de la app. Migra OpenAI gpt-4o + moderation + DLP + jailbreak + professional + semantic safety al backend.', 'DEV', 'Antonio', '90', 'OBJ-2,OBJ-3', 'B02', 'P0', '2026-05-25', '2026-06-14', 'todo'],
  ['B04', 'F2 — Dialogic classifier', '/api/dialogic/classify con caching por hash(message+context). Restaura badges de movimientos dialógicos en /chat.', 'DEV', 'Antonio', '20', 'OBJ-3', 'B03', 'P2', '2026-06-08', '2026-06-14', 'todo'],
  ['B05', 'F3 — Evaluator multi-rúbrica', '/api/evaluator/assess. Agente nuevo out-of-character. Evalúa progreso del usuario. Cubre formativa + sumativa + reporte exportable (lo que pidió Dafne).', 'DEV', 'Antonio', '80', 'OBJ-3', 'B03,B11', 'P1', '2026-06-08', '2026-06-28', 'todo'],
  ['B06', 'F4/F6 — STT opcional + GROW', 'F4: migrar Whisper de Cloud Function al nuevo backend (opcional). F6: /api/grow/message (devtool, solo developer/superadmin).', 'DEV', 'Antonio', '15', '', 'B03', 'P3', '2026-06-29', '2026-07-05', 'todo'],
  ['B07', 'F5 — Gemini Live (voz)', 'WebSocket bidireccional + audio bridge + analyzers async. Infra distinta (Cloud Run con WS o Fly.io). Fuera de ventana Yu Ping.', 'DEV', 'Antonio', '100', 'OBJ-3', 'B03,B04,B05,CMS 6 campos live*', 'P2', '2026-06-29', '2026-07-19', 'todo'],
  ['B08', 'Análisis briefing look & feel', 'A partir del documento proporcionado, analizar si se tiene la info para generar propuesta de look & feel.', 'UX', 'Dani', '4', 'OBJ-1', 'Briefing entregado', 'P0', '2026-05-11', '2026-05-17', 'todo'],
  ['B09', 'Propuesta look & feel', 'Benchmarking, paleta de color, logotipo, tipografía.', 'UX', 'Dani', '24', 'OBJ-1', 'B08 aprobado', 'P0', '2026-05-11', '2026-05-24', 'todo'],
  ['B10', 'Validación e iteración look & feel', 'Revisión de propuesta para verificar accesibilidad, usabilidad, contraste. Aplicar cambios si requiere.', 'UX', 'Dani', '8', 'OBJ-1', 'B09', 'P0', '2026-05-25', '2026-05-31', 'todo'],
  ['B11', 'Integración look & feel a flujos UX', 'Aplicar guidelines a flujos activos e iteraciones a desarrollar.', 'UX', 'Dani', '12', 'OBJ-1,OBJ-2', 'B10 aprobado', 'P1', '2026-06-01', '2026-06-07', 'todo'],
  ['B12', 'Mejoras Gestor de contenidos (mapeo)', 'Mapear alcance, permisos, flujo, roles y dinámica de funcionamiento del CMS.', 'UX', 'Dani', '4', 'OBJ-2,OBJ-4', '', 'P1', '2026-06-01', '2026-06-07', 'todo'],
  ['B13', 'Mejoras Gestor de contenidos (aplicación)', 'A partir del mapeo, integrar/diseñar los cambios al flujo UX del CMS.', 'UX', 'Dani', '12', 'OBJ-2,OBJ-4', 'B12', 'P1', '2026-06-01', '2026-06-14', 'todo'],
  ['B14', 'UI de progreso (consumir F3)', 'Diseñar componentes que muestran el reporte del evaluator: panel lateral / badges / modal final. Decisión de UX pendiente.', 'UX', 'Dani', '16', 'OBJ-3', 'B05', 'P1', '2026-06-08', '2026-06-21', 'todo'],
  ['B15', 'Guía para desarrollo de branding', 'Documento con descripción de la plataforma y pautas para look & feel y branding del producto.', 'DI', 'Dafne', '12', 'OBJ-1', 'Estudio comercial', 'P0', '2026-05-11', '2026-05-24', 'todo'],
  ['B16', 'Guía operativa del flujo editorial', 'Documenta el proceso editorial para creación de contenidos y validación de agentes conversacionales anclados a las experiencias.', 'DI', 'Dafne', '12', 'OBJ-2', '', 'P1', '2026-05-18', '2026-05-24', 'todo'],
  ['B17', 'Revisión nomenclatura de CMS', 'Revisar y afinar la nomenclatura propuesta para las categorías de configuración del gestor de contenidos.', 'DI', 'Dafne', '8', 'OBJ-4', '', 'P1', '2026-05-18', '2026-05-24', 'todo'],
  ['B18', 'Revisión categorías de contenidos en CMS', 'Análisis de la experiencia del flujo de instructor.', 'DI', 'Dafne', '8', 'OBJ-2', '', 'P1', '2026-05-25', '2026-05-31', 'todo'],
  ['B19', 'Criterios para evaluaciones post-práctica', 'Complementar el DI de evaluación post práctica y documentar en guía operativa. Alimenta directo a F3 (Evaluator).', 'DI', 'Dafne', '16', 'OBJ-3', 'Decisión rúbricas', 'P0', '2026-05-25', '2026-06-07', 'todo'],
  ['B20', 'Contenidos v1 catálogo de conversaciones difíciles', 'Se completa el último escenario pendiente de elaboración de contenidos del catálogo.', 'DI', 'Dafne', '8', 'OBJ-2', '', 'P1', '2026-05-18', '2026-05-24', 'todo'],
  ['B21', 'Revisión 18/32 escenarios', 'Revisar congruencia, completud y cumplimiento de criterios de fase editorial. 3h por escenario × 18 = 54h.', 'DI', 'Dafne', '54', 'OBJ-2', '', 'P1', '2026-05-25', '2026-06-07', 'todo'],
  ['B22', 'Vaciado 20/32 escenarios en plataforma', 'Capturar escenarios validados en la plataforma. 2h por escenario × 20 = 40h.', 'DI', 'Dafne', '40', 'OBJ-2', 'B21', 'P1', '2026-06-01', '2026-06-14', 'todo'],
  ['B23', 'Guía operativa de CMS (uso externo)', 'Guía de especificaciones para llenado del gestor, dirigida a usuarios externos (admins de empresa).', 'DI', 'Dafne', '12', 'OBJ-2,OBJ-4', 'B17', 'P1', '2026-06-08', '2026-06-14', 'todo'],
  ['B24', 'Pruebas chat + validación', 'Ejecución y validación de pruebas de chat post migración F1.', 'DI', 'Dafne', '16', 'OBJ-3', 'B03', 'P1', '2026-06-08', '2026-06-21', 'todo'],
  ['B25', 'Captura formal lead Credi-algo', 'Con Ángel: nombre real del cliente, decisor, contacto directo, ciclo de decisión, presupuesto si se deja. Antes de que se enfríe.', 'COM', 'Dafne+Ángel', '4', 'OBJ-4', 'Disponibilidad Ángel', 'P0', '2026-05-11', '2026-05-17', 'todo'],
  ['B26', 'Cerrar 17 decisiones técnicas del handoff', 'Hosting, Postgres, rate limits, cuotas, multi-tenant cost imputation, etc. Bloquea silenciosamente al dev.', 'COM', 'Pedro+Bruno', '8', 'OBJ-4', '', 'P0', '2026-05-11', '2026-05-24', 'todo'],
  ['B27', 'Mensaje y narrativa nueva a Yu Ping y Credi', 'Comunicar el upgrade de arquitectura como propuesta de valor reforzada, no como retraso. "Decidimos no servir empresas con arquitectura POC".', 'COM', 'Pedro', '2', 'OBJ-4', '', 'P0', '2026-05-11', '2026-05-17', 'todo'],
  ['B28', 'Estudio de mercado rápido', 'Para alimentar el brief de marca con factores diferenciadores (paleta, posicionamiento, competidores).', 'COM', 'Comercial', '8', 'OBJ-1', '', 'P1', '2026-05-11', '2026-05-17', 'todo'],
  ['B29', 'Sesión guiada con Yu Ping', 'Sesión en vivo donde ella crea su primer escenario con apoyo de Dafne + Antonio. Mantiene el lead caliente.', 'COM', 'Dafne+Antonio', '6', 'OBJ-2', 'B03 estable + escenarios cargados', 'P0', '2026-06-01', '2026-06-07', 'todo'],
  ['B30', 'Pricing model + contrato instancia enterprise', 'Definir modelo de pricing (por seat / por org / por scenario) y plantilla de contrato.', 'COM', 'Pedro+Bruno', '16', 'OBJ-4', 'Decisión modelo comercial Yu Ping (cerrada: cliente)', 'P1', '2026-05-25', '2026-06-07', 'todo'],
  ['B31', 'Cierre comercial Yu Ping', 'Conversación final post sesión guiada: contrato o piloto pagado.', 'COM', 'Pedro', '8', 'OBJ-4', 'B29,B30', 'P0', '2026-06-08', '2026-06-21', 'todo'],
  ['B32', 'Reunión 2 Credi-algo con propuesta concreta', 'Ya no demo: propuesta de piloto pagado con respuesta directa a sus 3 dolores (complejo/lento/caro).', 'COM', 'Ángel+Pedro', '4', 'OBJ-4', 'B25', 'P1', '2026-06-01', '2026-06-07', 'todo'],
];

const ROW_KEYS = ['id', 'title', 'description', 'track', 'owner', 'effort_hours', 'objective', 'dependencies', 'priority', 'start_date', 'end_date', 'status'];

function rowToObj(arr) {
  return Object.fromEntries(ROW_KEYS.map((k, i) => [k, arr[i]]));
}

function buildDescription(r) {
  const meta = [
    `Owner: ${r.owner}`,
    `Track: ${r.track}`,
    r.objective ? `Objetivo: ${r.objective}` : null,
    `Esfuerzo: ${r.effort_hours}h`,
    r.dependencies ? `Depende de: ${r.dependencies}` : null,
    `ID local: ${r.id}`,
  ].filter(Boolean).join(' · ');
  return `${r.description}\n\n— ${meta}`;
}

function buildTaskPayload(r) {
  const payload = {
    name: r.title,
    description: buildDescription(r),
    startDate: r.start_date,
    endDate: r.end_date,
    priority: PRIORITY_MAP[r.priority] ?? 'medium',
    status: 'not-started',
    type: 'task',
    color: TRACK_COLORS[r.track] ?? '#3B82F6',
  };
  if (/antonio/i.test(r.owner)) payload.assigneeId = ANTONIO_USER_ID;
  return payload;
}

// Only the dependency tokens that match B0X are treated as task-links.
function extractDeps(rawDeps) {
  if (!rawDeps) return [];
  return rawDeps
    .split(',')
    .map(s => s.trim())
    .map(s => {
      const m = s.match(/^(B\d{2})/);
      return m ? m[1] : null;
    })
    .filter(Boolean);
}

async function api(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}

async function main() {
  console.log(`API: ${API_BASE}`);
  console.log(`Token: ...${TOKEN.slice(-12)}`);

  // 0) Auth sync (idempotent — ensures the user row exists)
  try {
    await api('POST', '/auth/sync');
    console.log('auth/sync ✓');
  } catch (e) {
    console.warn('auth/sync warn:', e.status, e.body);
  }

  // 1) Create project
  console.log('\n→ Creando proyecto...');
  const project = await api('POST', '/projects', PROJECT_PAYLOAD);
  const projectId = project.id;
  console.log(`Proyecto creado ✓ id=${projectId}`);

  // 2) Create 32 tasks sequentially
  console.log('\n→ Creando tareas...');
  const localToApi = {};
  for (const arr of ROWS) {
    const r = rowToObj(arr);
    const payload = buildTaskPayload(r);
    try {
      const task = await api('POST', `/projects/${projectId}/tasks`, payload);
      localToApi[r.id] = task.id;
      console.log(`  ${r.id} ✓ id=${task.id} (${r.title.slice(0, 50)})`);
    } catch (e) {
      console.error(`  ${r.id} ✗ ${e.status}`, e.body);
      if (e.status === 401) {
        console.error('Token Firebase expirado o inválido. Aborta.');
        process.exit(1);
      }
    }
  }

  // 3) Create task-links for dependencies
  console.log('\n→ Creando dependencias (task-links)...');
  let linkCount = 0;
  for (const arr of ROWS) {
    const r = rowToObj(arr);
    const deps = extractDeps(r.dependencies);
    if (!deps.length) continue;
    const targetApiId = localToApi[r.id];
    if (!targetApiId) continue;
    for (const depLocal of deps) {
      const sourceApiId = localToApi[depLocal];
      if (!sourceApiId) {
        console.warn(`  ${r.id} ← ${depLocal} (sin id real, skip)`);
        continue;
      }
      try {
        await api('POST', `/projects/${projectId}/task-links`, {
          sourceTaskId: sourceApiId,
          targetTaskId: targetApiId,
          type: 'e2s',
        });
        console.log(`  ${depLocal} → ${r.id} ✓`);
        linkCount++;
      } catch (e) {
        console.error(`  ${depLocal} → ${r.id} ✗ ${e.status}`, e.body);
      }
    }
  }

  console.log(`\nResumen: proyecto ${projectId} · tareas ${Object.keys(localToApi).length}/32 · task-links ${linkCount}`);
  console.log(`Frontend: /project/${projectId}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
