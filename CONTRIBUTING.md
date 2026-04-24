# Guía de Contribución - Gantt Workgroup

## Sistema de Versionado Semántico

Este proyecto utiliza **Versionado Semántico** (SemVer) con el formato `MAJOR.MINOR.PATCH`:

### Reglas de Incremento de Versión

Cada Pull Request **DEBE** incluir una actualización de versión en `package.json` de acuerdo a la siguiente clasificación:

#### Patch Version (+0.0.1)
**Features pequeñas, correcciones y mejoras menores**

- Correcciones de bugs
- Ajustes de estilos/UI menores
- Actualizaciones de documentación
- Mejoras de rendimiento pequeñas
- Refactoring menor sin cambios de funcionalidad
- Correcciones de typos
- Ajustes menores en componentes, DTOs o controladores

**Ejemplo:** `0.1.5` → `0.1.6`

#### Minor Version (+0.1.0)
**Features medianas y mejoras significativas**

- Nuevas funcionalidades que no rompen compatibilidad
- Componentes nuevos para el Gantt
- Mejoras importantes de UX/UI
- Integraciones de servicios nuevos
- Refactoring significativo
- Nuevas configuraciones o herramientas
- Nuevos hooks o contexts
- Mejoras en el sistema de autenticación
- Nuevas funcionalidades en la gestión de tareas

**Ejemplo:** `0.1.5` → `0.2.0`

#### Major Version (+1.0.0)
**Features grandes, épicas o cambios breaking**

- Cambios que rompen compatibilidad (Breaking Changes)
- Rediseños completos de la aplicación
- Migraciones de arquitectura (ej: cambio de biblioteca Gantt)
- Épicas completas (múltiples features relacionadas)
- Cambios fundamentales en el core de la aplicación
- Cambios en el esquema Prisma que requieren migración destructiva
- Cambios en el sistema de autenticación/permisos

**Ejemplo:** `0.9.5` → `1.0.0`

---

## Proceso de Contribución

### 1. Crear rama con nombre descriptivo
```bash
git checkout -b feature/nombre-descriptivo
# o
git checkout -b fix/descripcion-del-fix
# o
git checkout -b epic/nombre-de-la-epica
```

**Convenciones de nombres de ramas:**
- `feature/` - Para nuevas funcionalidades
- `fix/` - Para correcciones de bugs
- `refactor/` - Para refactorizaciones
- `docs/` - Para cambios en documentación
- `test/` - Para agregar o modificar tests
- `epic/` - Para épicas o cambios grandes

### 2. Actualizar la versión en `package.json`

Según el tipo de cambio que estés haciendo, actualiza el campo `version`:

```json
{
  "version": "0.1.6"
}
```

### 3. Actualizar CHANGELOG.md

Agrega tus cambios en la sección `[Unreleased]` del CHANGELOG.md:

```markdown
## [Unreleased]

### Added
- Nueva funcionalidad de filtros en el Gantt chart

### Fixed
- Corregido error en el guardado de dependencias entre tareas
```

### 4. Crear commit descriptivo

```bash
git commit -m "feat: add task filtering to Gantt chart (#PR_NUMBER) - v0.2.0"
# o
git commit -m "fix: task dependency save error (#PR_NUMBER) - v0.1.6"
```

### 5. Crear Pull Request

El título del PR **DEBE** incluir:
- Tipo de cambio (feat/fix/docs/refactor/etc.)
- Versión a la que aporta
- Descripción breve

**Ejemplos:**
```
feat(v0.2.0): Add task filtering to Gantt chart
fix(v0.1.6): Fix task dependency save error
epic(v1.0.0): Complete redesign of project management system
```

### Template de PR

Al crear un Pull Request, usa el template proporcionado (`.github/pull_request_template.md`):

```markdown
## Tipo de Cambio
- [ ] Patch (v+0.0.1) - Fix/mejora menor
- [ ] Minor (v+0.1.0) - Feature mediana
- [ ] Major (v+1.0.0) - Epic/Breaking change

## Nueva Versión
**v0.X.X** → **v0.X.X**

## Descripción
<!-- Describe los cambios realizados -->

## Checklist
- [ ] Código probado localmente
- [ ] Version actualizada en `package.json`
- [ ] CHANGELOG.md actualizado
- [ ] Sin errores de lint/build
- [ ] Tests ejecutados (npm run test)
- [ ] Documentación actualizada (si aplica)
- [ ] Migración Prisma generada (si cambiaste el esquema)
- [ ] OpenAPI spec regenerado: `npm run api:openapi:dump` (si cambiaste endpoints)

## Screenshots (opcional)
<!-- Si hay cambios visuales en el Gantt o la UI -->

## Notas Adicionales
<!-- Información relevante para los revisores -->
```

---

## Convenciones de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Tipos comunes:
- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `docs`: Cambios en documentación
- `style`: Cambios de formato (no afectan código)
- `refactor`: Refactorización de código
- `test`: Agregar/modificar tests
- `chore`: Tareas de mantenimiento
- `perf`: Mejoras de rendimiento

### Scopes sugeridos:
- `auth`: Autenticación y permisos
- `gantt`: Componente Gantt y visualización
- `tasks`: Gestión de tareas
- `projects`: Gestión de proyectos
- `api`: Backend NestJS (controllers, services, DTOs)
- `db`: Esquema Prisma o migraciones
- `shared`: `packages/shared`
- `ui`: Componentes de interfaz
- `layout`: Layout y navegación
- `locales`: Internacionalización
- `deps`: Dependencias

**Ejemplos:**
```
feat(gantt): add task filtering by status
fix(tasks): validate parent-child hierarchy correctly
docs(readme): update local setup instructions
refactor(api): extract cycle-detection helper
test(tasks): add unit tests for TaskService
perf(gantt): optimize render performance for large datasets
```

---

## Control de Calidad

Antes de crear tu PR, asegúrate de:

```bash
# Lint
npm run lint

# TypeScript check + Build
npm run build

# Tests
npm run test:run

# Tests con coverage
npm run test:coverage
```

**Todos los comandos deben ejecutarse sin errores antes de crear el PR.**

---

## Manejo de CHANGELOG

El CHANGELOG sigue el formato [Keep a Changelog](https://keepachangelog.com/):

### Categorías disponibles:
- **Added**: Nuevas funcionalidades
- **Changed**: Cambios en funcionalidades existentes
- **Deprecated**: Funcionalidades que serán removidas
- **Removed**: Funcionalidades removidas
- **Fixed**: Correcciones de bugs
- **Security**: Correcciones de seguridad

### Ejemplo de entrada:

```markdown
## [Unreleased]

### Added
- Task filtering by status, priority, and assignee in Gantt chart
- Bulk operations for task management
- Export functionality to PDF and Excel

### Changed
- Improved task hierarchy visualization in Gantt
- Updated Spanish localization for new features

### Fixed
- Task dependency validation preventing circular references
- Date picker timezone issues
- Expansion state restoration after data reload

### Security
- Updated Firebase SDK to address CVE-2024-XXXXX
```

---

## Repository layout

- `apps/web` — Frontend React + Vite
- `apps/api` — Backend NestJS + Prisma 7
- `packages/shared` — DTOs y tipos compartidos

**Key files:**
- [apps/web/src/lib/apiClient.ts](apps/web/src/lib/apiClient.ts) — fetch wrapper con Firebase ID token
- [apps/web/src/services/ganttDataProvider.ts](apps/web/src/services/ganttDataProvider.ts) — puente con `wx-react-gantt`
- [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) — esquema de datos canónico
- [apps/api/src/auth/auth.guard.ts](apps/api/src/auth/auth.guard.ts) — validación dual Firebase + API keys

Consulta [README.md](README.md) y [CLAUDE.md](CLAUDE.md) para más detalles.

---

## Consideraciones Importantes

### Trabajando con Gantt Chart

1. **Siempre usa mappings** cuando trabajes con `FirestoreGanttDataProvider`
2. **Evita full reloads** después de acciones en el Gantt (pérdida de estado)
3. **Manejo de fechas**: wx-react-gantt requiere objetos `Date`, no strings o Timestamps
4. **Estado de expansión**: Manejado vía campo `open` en Firestore

### Backend y base de datos

1. **Nunca commitees** archivos `.env` o `service-account-key.json`.
2. **Esquema Prisma**: si lo cambias, genera migración con `npm run migrate` y commitea los archivos en `apps/api/prisma/migrations/`.
3. **OpenAPI**: tras modificar controladores o DTOs, regenera con `npm run api:openapi:dump` y commitea el `apps/api/openapi.json` actualizado.

### Tests

1. Agrega tests para nuevas funcionalidades
2. Asegúrate de que los tests existentes pasen
3. Mantén coverage > 70% (idealmente 80%+)

---

## Ejemplo Completo de Flujo

### 1. Crear rama
```bash
git checkout -b feat/task-filtering
```

### 2. Implementar cambios

Desarrolla la funcionalidad, asegurándote de:
- Seguir las convenciones del proyecto
- Agregar tests si aplica
- Actualizar tipos si es necesario

### 3. Actualizar package.json
```json
{
  "version": "0.2.0"
}
```

### 4. Actualizar CHANGELOG.md
```markdown
## [Unreleased]

### Added
- Task filtering by status, priority, and assignee in Gantt chart
- Filter toolbar component with real-time updates
```

### 5. Verificar calidad
```bash
npm run lint
npm run build
npm run test:run
```

### 6. Commit
```bash
git add .
git commit -m "feat(gantt): add task filtering functionality - v0.2.0

Implements filtering by status, priority, and assignee with real-time updates.
Includes new FilterToolbar component and updates to GanttChart integration."
```

### 7. Push y crear PR
```bash
git push origin feat/task-filtering
```

Crear PR con título: `feat(v0.2.0): Add task filtering to Gantt chart`

---

## Dudas y Preguntas

Si no estás seguro de algo:
1. **Revisa la documentación**: [README.md](README.md)
2. **Revisa PRs anteriores**: Busca ejemplos similares
3. **Pregunta en Issues**: Crea un issue de discusión o mensaje en el canal correspondiente
4. **En duda sobre versión**: Comienza con PATCH, el revisor ajustará si es necesario

---

## Recursos Útiles

- [Versionado Semántico](https://semver.org/lang/es/)
- [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
- [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/)
- [wx-react-gantt Documentation](https://docs.svar.dev/svelte/gantt/overview)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)

---

**¡Gracias por contribuir a Project Workgroup!** 
