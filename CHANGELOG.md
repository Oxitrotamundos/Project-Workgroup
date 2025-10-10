# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Added
- Sistema de versionado semántico
- Guía de contribución (CONTRIBUTING.md) con reglas de versionado
- CHANGELOG.md para seguimiento de cambios
- Template de Pull Request en `.github/pull_request_template.md`
- Hook `useAppVersion()` para acceder a la versión de la aplicación
- Componentes de versión:
  - `AppVersion` - Componente inline para mostrar versión
  - `VersionBadge` - Badge de versión en posición fija
- Variables globales de Vite para versión (`__APP_VERSION__`, `__APP_NAME__`)
- Badge de versión en el Dashboard

### Changed
- Actualizado README.md con documentación básica
- Configuración de Vite para inyectar versión en tiempo de compilación

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
