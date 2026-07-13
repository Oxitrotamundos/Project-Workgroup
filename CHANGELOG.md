# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

## [3.1.0] - 2026-07-13

Acceso a proyectos y gating de acciones por rol real: el gating de acciones de
tarjeta de proyecto comparaba el uid de Firebase contra el id numérico del
backend (nunca coincidía), y el conteo de miembros mostrado no reflejaba la
membresía real. No introduce breaking changes.

### Added
- `useUserRole` expone `userId`, el id numérico del backend (distinto del
  `uid` de Firebase)
- Navegación al detalle de un proyecto por click en toda la tarjeta o en su
  nombre (antes solo vía el ícono "ver proyecto")
- Botones "gestionar miembros" y "editar proyecto" en el header de detalle del
  proyecto (`ProjectView`), gateados por `isAdmin || isOwner`
- `memberCount` en `GET /v1/projects` y `GET /v1/projects/:id`: total real de
  personas con acceso (owner + `project_members`)

### Changed
- Acciones de tarjeta de proyecto (editar, eliminar, gestionar miembros)
  gateadas por `isAdmin || isOwner` usando el `userId` real, en lugar de la
  heurística de rol de proyecto (`isPM && isMember`)
- Tarjeta y header de proyecto muestran `memberCount` en lugar de
  `project.members.length`

### Fixed
- El gating de acciones de proyecto comparaba `user.uid` (Firebase) contra
  `project.ownerId` (id numérico del backend), una comparación que nunca
  coincidía para el owner real
- El conteo de miembros mostrado en la tarjeta y en el header del proyecto no
  reflejaba la membresía real

## [3.0.0] - 2026-07-08

Epic recursos asignables + panel admin: nueva entidad `resources` (kind
`user`|`placeholder`) desacopla la asignación de tareas y workload de `users`,
permitiendo asignar trabajo a personas sin cuenta (placeholders) y vincularlas
después a un usuario real. Incluye un panel de administración para gestionar
usuarios y recursos. A diferencia del bump Major anterior (v2.0.0), este PR **sí
introduce breaking changes** de contrato REST: ver sección Changed.

### Added
- Módulo `resources` (`/v1/resources`): CRUD admin-only, lectura abierta a
  cualquier autenticado (la necesita el selector de responsable del Gantt),
  `PATCH /v1/resources/:id/link-user` para vincular un placeholder a un usuario
  real (reasigna sus tasks/workload y borra el resource huérfano en una
  transacción), y `remove` restringido a placeholders sin tasks ni workload
  asociados
- `POST /v1/users` (admin): crea usuario en Firebase y en DB (con su `resource`
  `kind='user'`) en una transacción; compensa borrando el usuario de Firebase si
  la transacción DB falla
- `PATCH /v1/users/:id` (admin): edita `role`/`status`, con invariante que impide
  dejar el sistema sin ningún admin activo
- `PATCH /v1/projects/:projectId/members/:userId` (manager de proyecto): edita el
  rol de un miembro
- `UserStatus` (`active`/`disabled`): los usuarios `disabled` quedan bloqueados en
  los tres paths de resolución de identidad del `AuthGuard`
- Panel de administración `/admin/users` y `/admin/resources`, protegido por
  `AdminRoute` (rol global `admin`)
- Columna de avatar de responsable en el Gantt, inyectada por DOM
  (`ganttAssigneeCells.ts`) sobre las celdas `.wx-cell[data-col-id="assignee"]`
- 4 migraciones Prisma: `add_resources_and_user_status`,
  `backfill_resources_from_users`, `repoint_task_assignee_to_resources`,
  `repoint_workload_to_resources`
- Tests: 12 unitarios (`resources.service.spec.ts`) y 11 e2e
  (`resources.e2e-spec.ts`)

### Changed
- **BREAKING**: `tasks.assigneeId` y `workload` ahora referencian `resources.id`
  en lugar de `users.id` (remapeado con backfill en las 4 migraciones nuevas)
- **BREAKING**: `WorkloadResponse`, `CreateWorkloadDto` y `WorkloadQueryDto`
  renombran el campo `userId` a `resourceId`
- MCP: la tool `assign_task` busca contra `resources` (`searchResources`) en
  lugar de `users`; la búsqueda filtra `status=active` server-side
- `resolveAssigneeId` (tasks) renombrado a `resolveResourceId`; exige que el
  resource exista y esté `status='active'`
- `MemberService`/`useMembers`: roles y permisos de proyecto calculados a partir
  de datos reales (`projectRole`, `computePermissions`) en lugar de valores
  hardcodeados
- `ProjectMember.role` (frontend, `domain.ts`) tipado como `ProjectRole` en lugar
  de `UserRole`

### Fixed
- El template de assignee del Gantt se renderizaba como texto escapado (wx-react-gantt
  no interpreta HTML devuelto por `template`); reemplazado por inyección DOM
- Roles y permisos de miembros de proyecto mostraban etiquetas incorrectas al
  reutilizar las constantes de rol global (`admin`/`pm`/`member`) para el rol de
  proyecto (`manager`/`contributor`/`viewer`)

### Security
- Usuarios con `status='disabled'` no pueden autenticarse por ninguno de los tres
  paths del `AuthGuard` (Firebase ID token, JWT OAuth interno, API key)

## [2.1.0] - 2026-07-03

### Added
- Workflow `ci.yml`: lint + build + test en cada pull request y push a `main` (no existía ningún check automático antes de esto)
- Workflow `dependency-review.yml`: bloquea PRs que introduzcan dependencias con vulnerabilidades conocidas de severidad alta o superior
- Workflow `deploy-web.yml`: despliega `apps/web` a Firebase Hosting automáticamente al publicar un release en GitHub (con guardrails para prereleases y releases que no apunten a `main`), más disparo manual (`workflow_dispatch`) para reintentar un deploy
- Environment `production` en GitHub, restringido a la rama `main` y a cualquier tag, como guardrail adicional para el deploy
- Ruleset en `main` que exige los checks `ci` y `dependency-review` en verde antes de mergear

### Changed
- Script raíz `build`: ahora compila también `packages/mcp` antes de `apps/api` (antes solo funcionaba en local por builds viejos ya presentes en disco)
- `.nvmrc` actualizado de `18.19.1` a `20.20.0` para ser consistente con `engines.node`

### Fixed
- `apps/api` no compilaba en un checkout limpio: faltaba generar el cliente Prisma explícitamente (no hay postinstall que lo dispare)

### Security
- `js-yaml` actualizado (override `pnpm`) a `>=4.2.0`, cerrando la alerta de Dependabot #121 (GHSA-h67p-54hq-rp68, DoS por complejidad cuadrática en merge keys)

## [2.0.0] - 2026-07-02

Epic MCP: servidor Model Context Protocol sobre el API existente, con transporte HTTP
streamable, un servidor OAuth self-hosted como Authorization Server y tools de
lectura/escritura/flujo. No introduce breaking changes en las superficies REST `/v1/*`
ni en el frontend; el bump Major refleja la incorporación de una épica completa
(regla de `CONTRIBUTING.md`).

### Added
- Nuevo workspace `packages/mcp`: servidor MCP con entrypoint stdio y loader de configuración local
- Cliente API del MCP: thin client read-only con parsing del error-envelope y, más tarde, métodos de escritura con parsing multi-shape de errores de validación de Nest
- Read tools: `list_projects`, `get_task`, `find_person`, `list_tasks` (con filtros de status/type acotados a los enums compartidos y bounds de fecha), y un tool de project overview con descripción y fechas normalizadas
- Write tools: `create_task`, `update_task`, `assign_task`
- Flow tools: `daily_update` (batch con resolución de refs y retry por versión), `plan_project` (sobre el endpoint transaccional de import) y `reschedule_task`/`apply_reschedule` (preview + apply)
- Transporte MCP HTTP streamable montado en el API (`POST /mcp`), con su request handler en `packages/mcp`
- Servidor OAuth self-hosted montado como Authorization Server: metadata RFC 8414 (con alias del well-known a la discovery de oidc-provider), adapter Prisma y tabla propia, registro de clientes CIMD con host-allowlist estricta, consent automático para clientes allowlisted, interacción de login gated por Firebase (email/password incluido), TTL de tokens y claves de cookie desde configuración, y protected-resource metadata
- Tercer path del `AuthGuard`: validación de JWTs OAuth de MCP (con `exp` requerido) además de Firebase ID tokens y API keys
- Rate-limiting de las superficies públicas MCP y OAuth, keyed por IP del cliente
- Endpoint transaccional `POST /v1/projects/import` con su servicio y DTOs de import en `packages/shared`
- Servicio de limpieza que purga payloads OAuth expirados de forma periódica

### Changed
- Import de proyectos: auto-expansión del rango del proyecto para cubrir las tasks importadas
- Idempotencia: la clave se reclama antes del handler para frenar escrituras duplicadas ante retries concurrentes
- Imagen Docker del API: bump de la base de Node 20 a Node 22; el build ahora compila también el workspace `packages/mcp`

### Fixed
- Conflictos de versión de task se propagan en `update_task`/`daily_update` en lugar de reintentar a ciegas; `daily_update` re-resuelve el batch completo en el retry
- Timeout de request del cliente MCP elevado por encima del timeout de la tx de import del servidor
- Body-parser JSON global registrado antes de montar el AS OAuth (evitaba que Nest recibiera `req.body` en `/v1`)
- Rate-limits aplicados antes de la autenticación y keyed por IP
- Se niegan principals OAuth en el controlador de api-keys
- Coerción a número del query param `limit` en la búsqueda de usuarios
- Manejo de respuesta flat-array en la lista de proyectos del frontend
- Rechazo de dependencias duplicadas en el import de proyectos
- La claim de idempotencia se conserva cuando falla la persistencia de la respuesta
- MCP: nombre de task ambiguo rechazado en `daily_update`; overflow marcado en las listas del project overview; promedio solo sobre el progreso de tasks

### Security
- CVEs parcheados vía pnpm overrides: `qs` ≥6.15.2 (DoS, GHSA-q8mj-m7cp-5q26), `esbuild` ≥0.28.1 (arbitrary file read en dev-server, GHSA-g7r4-m6w7-qqqr) y `@babel/core` ≥7.29.6 <8 (arbitrary file read, GHSA-4x5r-pxfx-6jf8)
- Hardening de las superficies públicas: rate-limiting antes de auth, rechazo de requests destructivos para tokens OAuth de MCP y `exp` obligatorio en los JWTs

## [1.1.0] - 2026-06-25

### Added
- `GanttDragTooltip`: tooltip flotante durante arrastre/resize que muestra las fechas destino formateadas según la granularidad del zoom activo
- Snap al unit de zoom: `lengthUnit` derivado del tier activo (hora con zoom de horas, día en el resto), reemplazando el valor fijo anterior
- `computeStructuralKey`: utility que incluye IDs de tasks, links y `parentId` para detectar cuándo regenerar las props del Gantt sin recargar la página
- Movimiento de summary como group shift: mover una barra summary desplaza todos los descendientes hoja el mismo delta vía `bulkUpdate` atómico
- Non-summary tasks contribuyen sus propias fechas a la visualización del Gantt
- `computeSummaryBounds` en `packages/shared/src/utils/summary-bounds.ts`: función pura compartida entre web y api
- Nuevos DTOs en `packages/shared`: `CreateProjectDto`, `UpdateProjectDto`, `AddProjectMemberDto`, `ProjectMemberResponse`, `CreateTaskDto`, `UpdateTaskDto`, `CreateTaskLinkDto`, `UpdateTaskLinkDto`, `CreateWorkloadDto`, `WorkloadQueryDto`, `SearchUsersQueryDto`, `UserResponse`, `CreateApiKeyDto`, `ApiKeyResponse`, `UpsertCalendarDto`, `WorkingDayPatternDto`, `HolidayDto`
- Tests unitarios para `computeSummaryBounds`, `GanttDragTooltip` y `computeStructuralKey`

### Changed
- `GanttDataProvider`: índice de hijos construido una sola vez O(N) por llamada a `toGanttData`; `computeSummaryBounds` y `hasChildren` reutilizan el mismo índice
- `GanttDataProvider.destroy()`: descarga open-states y leaf-shifts antes de limpiar el estado interno
- `flushLeafShifts`: resuelve `expectedVersion` en el momento del flush; aplica trabajo confirmado en persistencia multi-chunk parcial; revierte la UI cuando el bulk falla con nada persistido
- `bufferPropagatedLeaf`: cancela el PATCH individual pendiente para el mismo leaf cuando llega un flush, evitando escritura doble
- `tasks.service.ts` (api): usa `computeSummaryBounds` compartido en lugar de la implementación local equivalente

### Fixed
- Movimientos de summary persisten ahora como group shift vía `bulkUpdate`; antes dependían de eventos internos frágiles de wx-react-gantt
- Re-parentizaciones detectadas como cambio estructural al incluir `parentId` en la clave; antes el árbol no se reconstruía hasta recargar
- `tsconfig.app.json`: eliminado `baseUrl: "."` redundante que causaba resolución de módulos ambigua con bundler moduleResolution
- Tests e2e de API: `import request = require('supertest')` reemplazado por `import request from 'supertest'`

### Security
- Overrides de pnpm con scope para AJV (`@eslint/eslintrc>ajv`, `eslint>ajv`) y brace-expansion (`minimatch>brace-expansion`) que restituyen la compatibilidad de ESLint 9 con las versiones de API que espera
- CVEs parcheados: vitest ≥3.2.6, vite ≥7.3.5, shell-quote ≥1.8.4, `@grpc/grpc-js` ≥1.14.4, ws ≥7.5.11, form-data ≥4.0.6, undici ≥7.28.0, hono ≥4.12.25, multer ≥2.2.0, tmp ≥0.2.6, protobufjs ≥8.4.1
- Eliminados 78 usos de `@typescript-eslint/no-explicit-any` en servicios, componentes y tests; reemplazados por interfaces de dominio concretas o `unknown` con guards

## [1.0.0] - 2026-05-21

### Added
- Nuevo workspace `apps/api`: NestJS 10 + Prisma 7 + PostgreSQL 16
- API REST bajo `/v1/*` con documentación Swagger en `/v1/docs`
- Autenticación dual: Firebase ID tokens (frontend) + API keys con hash argon2 (clientes externos)
- Gestión de API keys: crear, listar, revocar, reveal único en texto plano
- Sistema de calendarios laborales: calendarios globales y por proyecto, festivos, integración con reprogramación de tareas
- Locking optimista: columna `version` en `tasks` y `task_links`
- Interceptor de idempotencia con servicio de limpieza periódica
- Endpoints de bulk update y propagación de fechas en cascada para tareas
- Detector de ciclos para validación de dependencias entre tareas
- Módulo de workload
- Servicio de métricas y endpoint de health check (`/health`)
- `BigIntSerializerInterceptor`: serialización transparente `bigint` → `string` en respuestas
- Docker multi-stage build para el API (`apps/api/Dockerfile`)
- Workflow de generación y verificación de OpenAPI spec (`api:openapi:dump`, `api:openapi:check`)
- Suite de tests e2e con testcontainers (API keys, project members, tasks)
- `apiClient.ts`: cliente HTTP único con inyección y renovación automática de Firebase ID token
- Capa de servicios en el frontend: projectService, taskService, taskLinkService, memberService, userService, apiKeyService
- Hooks de datos: `useProjects`, `useUserRole`, `useProjectMembers`, `useTaskLinks`
- `ProjectSettingsContext` y página de configuración de proyecto
- Página de configuración de calendarios (`/account/calendar`)
- Página de gestión de API keys (`/account/api-keys`)
- `ThemeContext` para modo claro/oscuro
- `TweaksPanel` para personalización de diseño
- Vista de lista de tareas con footer
- Tests unitarios: CalendarChip, TaskSidebar, ProjectList, useProjects, useUserRole, GanttDataProvider
- Sistema de versionado semántico con hook `useAppVersion()` y componentes `AppVersion`, `VersionBadge`
- Guía de contribución (CONTRIBUTING.md) con reglas de versionado
- Template de Pull Request en `.github/pull_request_template.md`
- Configuración pnpm workspace (`pnpm-workspace.yaml`)

### Changed
- Frontend migrado de Firestore SDK a REST API vía `apiClient.ts`
- `GanttDataProvider` refactorizado para API PostgreSQL; IDs de tarea transmitidos como strings (bigint PostgreSQL)
- Flujo de auth: primer login llama `POST /v1/auth/sync` para crear/actualizar registro de usuario
- `start_date`/`end_date` en tareas migrado a `TIMESTAMPTZ(0)`
- Lógica de scheduling: `endDate` tiene prioridad sobre `estimatedHours`
- Gantt: zoom, throttling de actualizaciones, componente `GanttTimeline` integrado
- Login consolidado en componente único con Google sign-in; Email/Password añadido como opción secundaria
- Navegación: configuración de rutas actualizada con breadcrumbs
- `GanttSnapOverlay` eliminado; lógica de snap optimizada en `GanttChart`
- README.md actualizado con documentación de la nueva arquitectura
- Configuración de Vite para inyectar versión en tiempo de compilación

### Removed
- Backend Firestore como capa de almacenamiento
- `FirestoreGanttDataProvider` y mapping bidireccional string↔numérico de IDs
- Reglas de seguridad e índices de Firestore
- Scripts de setup de Firestore (`setup:cli`, `setup:firestore`, `setup:firestore:sample`)
- Configuración de Firebase en el backend

### Security
- `firebase-admin` actualizado a versión parcheada
- pnpm overrides añadidos: `protobufjs ≥7.5.6`, `fast-xml-parser ≥4.5.3`, `fast-xml-builder ≥1.1.7`, `glob ≥10.5.0`, `picomatch ≥4.0.2`, `fast-uri ≥3.1.2`, `lodash ≥4.18.0`, `multer ≥2.1.1`
- `react-router-dom`, `vite`, `postcss`, `firebase` actualizados a versiones parcheadas

## [0.1.0] - 2025-01-15

### Added
- Spanish localization support for Gantt chart components
- Current day marker in Gantt timeline for improved visibility
- Timeline markers support via GanttMarker interface
- wx-core-locales and wx-gantt-locales dependencies
- Spanish locale files: `src/locales/es.ts` and `src/locales/gantt-es.ts`
- LocaleProvider component for internationalization

### Changed
- Enhanced layout and UI improvements (PR #8)
- Improved Gantt chart visualization with better timeline markers
- Updated project structure and organization

### Fixed
- Timeline visibility issues with marker implementation
- Localization issues in Gantt chart interface

## [0.0.1] - Initial Release

### Added
- Initial project setup with React + TypeScript + Vite
- Firebase/Firestore integration for backend
- wx-react-gantt library for Gantt chart visualization
- Dual-layer architecture (Firestore + wx-react-gantt)
- FirestoreGanttDataProvider for data synchronization
- Authentication system with Firebase Auth
- User role management (admin, pm, member)
- Project management functionality
- Task management with hierarchy support
- Task links (dependencies) management
- Core services:
  - TaskService for task CRUD operations
  - TaskLinkService for dependency management
  - ProjectService for project management
- UI Components:
  - AppLayout with persistent navigation
  - GanttChart component
  - AuthContext for authentication state
- Protected routes based on user roles
- Firestore security rules
- Firestore indexes configuration
- Scripts for Firestore setup:
  - Interactive CLI setup (`setup:cli`)
  - Basic setup (`setup:firestore`)
  - Setup with sample data (`setup:firestore:sample`)
- Testing setup with Vitest and React Testing Library
- ESLint configuration
- TypeScript configuration with project references
- Tailwind CSS v4 integration
- Build configuration with Vite

### Technical Features
- Bidirectional ID mapping (Firestore string IDs ↔ Gantt numeric IDs)
- Task hierarchy with parent-child relationships
- Task link validation (prevents circular dependencies)
- Expansion state persistence
- Date handling conversion (Firestore Timestamps ↔ Date objects)
- Type system with separate Firestore and UI types

---

## Formato de Entradas

### Added
Para nuevas funcionalidades.

### Changed
Para cambios en funcionalidades existentes.

### Deprecated
Para funcionalidades que pronto serán removidas.

### Removed
Para funcionalidades removidas.

### Fixed
Para correcciones de bugs.

### Security
Para correcciones de vulnerabilidades de seguridad.

---

## Guía de Versionado

- **MAJOR** (v+1.0.0): Cambios incompatibles con versiones anteriores
- **MINOR** (v+0.1.0): Nuevas funcionalidades compatibles con versiones anteriores
- **PATCH** (v+0.0.1): Correcciones de bugs y mejoras menores

Para más información, consulta [CONTRIBUTING.md](CONTRIBUTING.md).
