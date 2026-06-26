# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

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
