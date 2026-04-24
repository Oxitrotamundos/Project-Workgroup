# Project Workgroup

[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/Oxitrotamundos/Gannt-Workgroup?style=flat&label=version)](https://github.com/Oxitrotamundos/Gannt-Workgroup/releases/latest)

Aplicación web de gestión de proyectos con visualización tipo Gantt. Frontend en **React + TypeScript + Vite**, backend en **NestJS + Prisma + PostgreSQL**, autenticación con **Firebase Auth (Google-only)** y API REST pública documentada con OpenAPI.

## Características principales

* Gráfico Gantt interactivo (wx-react-gantt)
* Gestión de proyectos, tareas jerárquicas y dependencias
* API REST versionada (`/v1`) con OpenAPI en `/v1/docs`
* Autenticación dual: Firebase ID tokens (UI) + API keys (clientes externos)
* Diseño adaptable y soporte en español

## Requisitos

* Node.js >= 18.19.0
* npm >= 9.0.0
* Docker + Docker Compose (para Postgres local)
* Proyecto Firebase con provider Google habilitado

## Estructura del monorepo

```
apps/
├── web/       # Frontend React + Vite
└── api/       # Backend NestJS + Prisma
packages/
└── shared/    # DTOs y tipos compartidos
```

## Desarrollo

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Copiar archivos `.env.example`:
   - `apps/web/.env.example` → `apps/web/.env` (Firebase Auth vars + `VITE_API_URL`)
   - `apps/api/.env.example` → `apps/api/.env` (`DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON`)

3. Levantar Postgres local:
   ```bash
   npm run db:up
   ```

4. Aplicar migraciones:
   ```bash
   npm run migrate
   ```

5. (Opcional) sembrar admin de prueba:
   ```bash
   SEED_ADMIN_UID=<firebase-uid> SEED_ADMIN_EMAIL=<email> npm run seed
   ```

6. Arrancar web + api concurrentemente:
   ```bash
   npm run dev
   ```

- Web:    http://localhost:5173
- API:    http://localhost:3000
- Docs:   http://localhost:3000/v1/docs

## Testing

```bash
npm run test                 # web + api
npm -w apps/web run test:run
npm -w apps/api run test
npm -w apps/api run test:e2e
```

## Stack tecnológico

* **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS 4
* **Backend:** NestJS 10 + Prisma 7 + PostgreSQL 16
* **Auth:** Firebase Auth (Google provider) + API keys argon2id
* **Gantt:** wx-react-gantt

## Contribución

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para convenciones de ramas, commits y versionado.
