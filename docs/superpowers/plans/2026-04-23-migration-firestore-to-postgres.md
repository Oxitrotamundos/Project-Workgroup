# Firestore → Postgres Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Project-Workgroup from Firestore to a self-hosted Postgres + NestJS backend while keeping Firebase Auth (Google-only), reorganizing the repo into a monorepo and exposing a versioned REST API with OpenAPI that also supports API-key auth for external clients.

**Architecture:** npm workspaces monorepo (`apps/web` + `apps/api` + `packages/shared`). Backend is NestJS 10 + Prisma 5 + Postgres 16. Auth is dual: Firebase ID tokens (frontend humans) OR argon2-hashed API keys (external clients), resolved by a single `AuthGuard`. DTOs live in `packages/shared` so frontend and backend share types. Frontend `src/services/*` becomes wrappers over a fetch-based `apiClient`; the brittle string↔number ID mapping in `ganttDataProvider` disappears because Postgres emits `bigint` directly.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL 16 (Docker local / Supabase prod), `firebase-admin`, `argon2`, `class-validator`, `@nestjs/swagger`, Jest + supertest + testcontainers, React 18 + Vite (existing), Vitest, Railway (backend deploy).

---

## Phase 1 — Bootstrap monorepo

### Task 1.1: Create working branch

**Files:** _(no files; git only)_

- [ ] **Step 1: Verify clean working tree**

Run: `git status --porcelain`
Expected: empty output. If not, abort and let the user commit/stash first.

- [ ] **Step 2: Create branch from current**

Run:
```bash
git checkout -b feature/monorepo-api-migration
```
Expected: `Switched to a new branch 'feature/monorepo-api-migration'`.

- [ ] **Step 3: Commit checkpoint**

Run:
```bash
git commit --allow-empty -m "chore: start monorepo + api migration"
```

### Task 1.2: Move frontend into `apps/web/`

**Files:**
- Create: `apps/web/` (directory)
- Move: all frontend files from repo root into `apps/web/`

- [ ] **Step 1: Create target dir**

Run: `mkdir -p apps/web`

- [ ] **Step 2: Move source code and static assets**

Run:
```bash
git mv src apps/web/src
git mv public apps/web/public
git mv index.html apps/web/index.html
```

- [ ] **Step 3: Move config files**

Run:
```bash
git mv vite.config.ts apps/web/vite.config.ts
git mv tsconfig.json apps/web/tsconfig.json
git mv tsconfig.app.json apps/web/tsconfig.app.json
git mv tsconfig.node.json apps/web/tsconfig.node.json
git mv tailwind.config.js apps/web/tailwind.config.js
git mv postcss.config.js apps/web/postcss.config.js
git mv eslint.config.js apps/web/eslint.config.js
```

- [ ] **Step 4: Move package manifests**

Run:
```bash
git mv package.json apps/web/package.json
git mv package-lock.json apps/web/package-lock.json
```

- [ ] **Step 5: Move stray files flagged in status**

```bash
git mv taskService.ts apps/web/src/services/taskService.ts 2>/dev/null || true
```
(The `git status` at session start showed a stray `taskService.ts` at root — if still present, move it; otherwise skip.)

- [ ] **Step 6: Commit move**

```bash
git add -A
git commit -m "refactor: move frontend into apps/web/ for monorepo layout"
```

### Task 1.3: Create root `package.json` with workspaces

**Files:**
- Create: `package.json` (new root)

- [ ] **Step 1: Write root manifest**

Create `/Users/ab/Documents/Proyectos/Interno/Project-Workgroup/package.json`:

```json
{
  "name": "project-workgroup",
  "private": true,
  "version": "0.2.0",
  "engines": {
    "node": ">=18.19.0",
    "npm": ">=9.0.0"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "concurrently -n web,api -c auto \"npm:dev:web\" \"npm:dev:api\"",
    "dev:web": "npm -w apps/web run dev",
    "dev:api": "npm -w apps/api run start:dev",
    "build": "npm -w apps/web run build && npm -w apps/api run build",
    "lint": "npm -w apps/web run lint && npm -w apps/api run lint",
    "test": "npm -w apps/web run test:run && npm -w apps/api run test",
    "db:up": "docker compose -f apps/api/docker-compose.dev.yml up -d",
    "db:down": "docker compose -f apps/api/docker-compose.dev.yml down",
    "migrate": "npm -w apps/api exec prisma migrate dev",
    "seed": "npm -w apps/api exec prisma db seed",
    "api:openapi:dump": "npm -w apps/api run openapi:dump",
    "api:openapi:check": "npm -w apps/api run openapi:check"
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

- [ ] **Step 2: Remove `apps/web/package-lock.json`**

Workspaces use a single root lockfile:
```bash
rm apps/web/package-lock.json
```

- [ ] **Step 3: Install dependencies from root**

Run: `npm install`
Expected: `node_modules` created at root; `apps/web/node_modules` is a symlink shell.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json apps/web/package-lock.json
git commit -m "chore: add npm workspaces at root"
```

### Task 1.4: Smoke-test frontend still runs

**Files:** _(none)_

- [ ] **Step 1: Run dev server**

Run: `npm run dev:web`
Expected: Vite reports `Local: http://localhost:5173/`. No errors about missing files.

- [ ] **Step 2: Stop the server**

Ctrl-C.

- [ ] **Step 3: Build check**

Run: `npm -w apps/web run build`
Expected: `dist/` created inside `apps/web/`, no type errors.

- [ ] **Step 4: Clean up build artifact**

```bash
rm -rf apps/web/dist
```

### Task 1.5: Scaffold `apps/api` with NestJS

**Files:**
- Create: `apps/api/**` (generated by nest-cli)

- [ ] **Step 1: Generate**

Run:
```bash
npx -y @nestjs/cli@10 new apps/api --package-manager npm --skip-git --skip-install --strict
```
Expected: directory `apps/api` with boilerplate.

- [ ] **Step 2: Delete the nested lockfile and `.git` artifacts**

```bash
rm -f apps/api/package-lock.json
rm -rf apps/api/.git
```

- [ ] **Step 3: Adjust `apps/api/package.json`**

Replace the generated `name` and `version` fields and add `openapi:*` scripts. Open `apps/api/package.json` and ensure:

```json
{
  "name": "@project-workgroup/api",
  "version": "0.1.0",
  "private": true,
  "description": "Project-Workgroup backend API",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main.js",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "openapi:dump": "ts-node src/cli/dump-openapi.ts",
    "openapi:check": "ts-node src/cli/check-openapi.ts"
  }
}
```

Keep all dependencies/devDependencies that nest-cli generated.

- [ ] **Step 4: Install from root**

Run: `npm install`
Expected: `apps/api` dependencies hoisted into the root lockfile.

- [ ] **Step 5: Smoke-test the API boots**

Run: `npm run dev:api`
Expected: `[Nest] ... Application is running on: http://localhost:3000`.
Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add apps/api package.json package-lock.json
git commit -m "feat(api): scaffold NestJS project in apps/api"
```

### Task 1.6: Create `packages/shared`

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create structure**

```bash
mkdir -p packages/shared/src
```

- [ ] **Step 2: Write `packages/shared/package.json`**

```json
{
  "name": "@project-workgroup/shared",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "class-validator": "^0.14.1",
    "class-transformer": "^0.5.1"
  },
  "devDependencies": {
    "typescript": "~5.6.0"
  }
}
```

- [ ] **Step 3: Write `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `packages/shared/src/index.ts`**

```ts
export {};
```

(Placeholder until DTOs are added in Phase 4.)

- [ ] **Step 5: Install and typecheck**

```bash
npm install
npm -w packages/shared run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared package.json package-lock.json
git commit -m "feat(shared): add packages/shared workspace"
```

### Task 1.7: Verify root orchestration works

**Files:** _(none)_

- [ ] **Step 1: Run both dev servers together**

Run: `npm run dev`
Expected: both `web` (5173) and `api` (3000) start. `curl -sf http://localhost:3000` returns `Hello World!` from Nest.

- [ ] **Step 2: Stop**

Ctrl-C.

- [ ] **Step 3: Commit checkpoint**

```bash
git commit --allow-empty -m "chore: phase 1 bootstrap complete"
```

---

## Phase 2 — Schema + DB infra

### Task 2.1: Docker Compose for local Postgres

**Files:**
- Create: `apps/api/docker-compose.dev.yml`
- Create: `apps/api/.env.example`
- Create: `apps/api/.env` (gitignored)

- [ ] **Step 1: Write compose file**

`apps/api/docker-compose.dev.yml`:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: pwg_postgres_dev
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: pwg
      POSTGRES_PASSWORD: pwg
      POSTGRES_DB: pwg_dev
    volumes:
      - pwg_pgdata:/var/lib/postgresql/data

volumes:
  pwg_pgdata:
```

- [ ] **Step 2: Write `apps/api/.env.example`**

```
DATABASE_URL=postgresql://pwg:pwg@localhost:5432/pwg_dev?schema=public
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173
FIREBASE_SERVICE_ACCOUNT_JSON=
```

- [ ] **Step 3: Copy to `.env` for local use**

```bash
cp apps/api/.env.example apps/api/.env
```

- [ ] **Step 4: Ensure `.env` is ignored**

Append to root `.gitignore` if missing:
```
apps/api/.env
apps/api/.env.local
```

- [ ] **Step 5: Bring up Postgres**

Run: `npm run db:up`
Expected: `docker compose ... Started`. Verify:
```bash
docker exec pwg_postgres_dev psql -U pwg -d pwg_dev -c '\dt'
```
Expected: "Did not find any relations."

- [ ] **Step 6: Commit**

```bash
git add apps/api/docker-compose.dev.yml apps/api/.env.example .gitignore
git commit -m "feat(api): docker-compose for local postgres"
```

### Task 2.2: Install and init Prisma

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Install Prisma**

```bash
npm -w apps/api i -D prisma ts-node
npm -w apps/api i @prisma/client
```

- [ ] **Step 2: Init prisma**

```bash
cd apps/api && npx prisma init --datasource-provider postgresql && cd -
```
Expected: `apps/api/prisma/schema.prisma` created, `apps/api/.env` updated (keep existing `DATABASE_URL` — Prisma init won't overwrite).

- [ ] **Step 3: Verify datasource wiring**

Open `apps/api/prisma/schema.prisma` and confirm:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json apps/api/prisma package-lock.json
git commit -m "feat(api): install prisma + init schema"
```

### Task 2.3: Define enums

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Append enums**

Append to `apps/api/prisma/schema.prisma`:
```prisma
enum GlobalRole {
  admin
  pm
  member
}

enum ProjectRole {
  manager
  contributor
  viewer
}

enum ProjectStatus {
  planning
  active
  completed
  on_hold
}

enum TaskStatus {
  not_started
  in_progress
  completed
  blocked
}

enum TaskPriority {
  low
  medium
  high
  critical
}

enum TaskType {
  task
  summary
  milestone
}

enum TaskLinkType {
  e2s
  s2s
  e2e
  s2e
}
```

(Note: Postgres enum values can't start with a digit or contain hyphens, so `on_hold` maps back to `on-hold` at the DTO layer.)

- [ ] **Step 2: Format + validate**

```bash
npm -w apps/api exec prisma format
npm -w apps/api exec prisma validate
```
Expected: "The schema is valid."

### Task 2.4: Define `User` model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Append model**

```prisma
model User {
  id            BigInt   @id @default(autoincrement())
  firebaseUid   String   @unique @map("firebase_uid")
  email         String   @unique
  displayName   String   @map("display_name")
  role          GlobalRole @default(member)
  avatarUrl     String?  @map("avatar_url")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt       @map("updated_at")

  ownedProjects    Project[]       @relation("ProjectOwner")
  projectMemberships ProjectMember[]
  assignedTasks    Task[]          @relation("TaskAssignee")
  workload         Workload[]
  apiKeys          ApiKey[]

  @@map("users")
}
```

- [ ] **Step 2: Validate**

`npm -w apps/api exec prisma validate`

### Task 2.5: Define `Project` + `ProjectMember`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Append models**

```prisma
model Project {
  id          BigInt        @id @default(autoincrement())
  name        String
  description String?
  startDate   DateTime      @map("start_date") @db.Date
  endDate     DateTime      @map("end_date")   @db.Date
  status      ProjectStatus @default(planning)
  ownerId     BigInt        @map("owner_id")
  color       String
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt       @map("updated_at")

  owner     User            @relation("ProjectOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  members   ProjectMember[]
  tasks     Task[]
  taskLinks TaskLink[]
  workload  Workload[]

  @@index([ownerId, status])
  @@map("projects")
}

model ProjectMember {
  projectId   BigInt      @map("project_id")
  userId      BigInt      @map("user_id")
  projectRole ProjectRole @default(contributor) @map("project_role")
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt       @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([projectId, userId])
  @@index([userId])
  @@map("project_members")
}
```

- [ ] **Step 2: Validate**

`npm -w apps/api exec prisma validate`

### Task 2.6: Define `Task` + `TaskLink`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Append models**

```prisma
model Task {
  id              BigInt       @id @default(autoincrement())
  projectId       BigInt       @map("project_id")
  parentId        BigInt?      @map("parent_id")
  assigneeId      BigInt?      @map("assignee_id")
  name            String
  description     String?
  startDate       DateTime     @map("start_date") @db.Date
  endDate         DateTime     @map("end_date")   @db.Date
  duration        Decimal      @db.Decimal(10, 2)
  progress        Int          @default(0)
  priority        TaskPriority @default(medium)
  status          TaskStatus   @default(not_started)
  type            TaskType     @default(task)
  color           String
  order           Decimal      @db.Decimal(30, 15)
  open            Boolean      @default(true)
  tags            String[]     @default([])
  estimatedHours  Decimal      @default(0) @map("estimated_hours") @db.Decimal(10, 2)
  actualHours     Decimal?     @map("actual_hours") @db.Decimal(10, 2)
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt       @map("updated_at")

  project    Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parent     Task?      @relation("TaskChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children   Task[]     @relation("TaskChildren")
  assignee   User?      @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  linksOut   TaskLink[] @relation("LinkSource")
  linksIn    TaskLink[] @relation("LinkTarget")
  workload   Workload[]

  @@index([projectId, order])
  @@index([projectId, status])
  @@index([assigneeId, status])
  @@map("tasks")
}

model TaskLink {
  id           BigInt       @id @default(autoincrement())
  projectId    BigInt       @map("project_id")
  sourceTaskId BigInt       @map("source_task_id")
  targetTaskId BigInt       @map("target_task_id")
  type         TaskLinkType
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt       @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  source  Task    @relation("LinkSource", fields: [sourceTaskId], references: [id], onDelete: Cascade)
  target  Task    @relation("LinkTarget", fields: [targetTaskId], references: [id], onDelete: Cascade)

  @@unique([sourceTaskId, targetTaskId, type])
  @@index([projectId])
  @@index([sourceTaskId])
  @@index([targetTaskId])
  @@map("task_links")
}
```

- [ ] **Step 2: Validate**

`npm -w apps/api exec prisma validate`

### Task 2.7: Define `Workload` + `ApiKey`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Append models**

```prisma
model Workload {
  id              BigInt   @id @default(autoincrement())
  userId          BigInt   @map("user_id")
  taskId          BigInt   @map("task_id")
  projectId       BigInt   @map("project_id")
  date            DateTime @db.Date
  allocatedHours  Decimal  @map("allocated_hours") @db.Decimal(10, 2)
  actualHours     Decimal? @map("actual_hours") @db.Decimal(10, 2)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt       @map("updated_at")

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  task    Task    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([userId, date])
  @@index([projectId, date])
  @@map("workload")
}

model ApiKey {
  id          BigInt    @id @default(autoincrement())
  userId      BigInt    @map("user_id")
  name        String
  keyHash     String    @unique @map("key_hash")
  prefix      String
  lastUsedAt  DateTime? @map("last_used_at")
  expiresAt   DateTime? @map("expires_at")
  revokedAt   DateTime? @map("revoked_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("api_keys")
}
```

- [ ] **Step 2: Validate full schema**

```bash
npm -w apps/api exec prisma format
npm -w apps/api exec prisma validate
```
Expected: "The schema is valid."

### Task 2.8: Run initial migration

**Files:**
- Create: `apps/api/prisma/migrations/<timestamp>_init/`

- [ ] **Step 1: Ensure Postgres is running**

`docker ps | grep pwg_postgres_dev`
If not up: `npm run db:up`.

- [ ] **Step 2: Create + apply migration**

```bash
npm -w apps/api exec prisma migrate dev --name init
```
Expected: migration SQL generated, applied; "Your database is now in sync with your schema."

- [ ] **Step 3: Verify tables**

```bash
docker exec pwg_postgres_dev psql -U pwg -d pwg_dev -c '\dt'
```
Expected: 8 tables listed (`users`, `projects`, `project_members`, `tasks`, `task_links`, `workload`, `api_keys`, `_prisma_migrations`).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(api): prisma schema + initial migration"
```

### Task 2.9: Seed script

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Modify: `apps/api/package.json` (add prisma seed config)

- [ ] **Step 1: Write seed**

`apps/api/prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const firebaseUid = process.env.SEED_ADMIN_UID ?? 'dev-admin-placeholder';
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.local';

  await prisma.user.upsert({
    where: { firebaseUid },
    update: { role: 'admin' },
    create: {
      firebaseUid,
      email,
      displayName: 'Dev Admin',
      role: 'admin',
    },
  });

  console.log(`Seeded admin ${email} (firebaseUid=${firebaseUid})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Add prisma seed config**

In `apps/api/package.json`, add top-level key:
```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

- [ ] **Step 3: Run seed**

```bash
npm run seed
```
Expected: `Seeded admin admin@example.local (firebaseUid=dev-admin-placeholder)`.

- [ ] **Step 4: Verify**

```bash
docker exec pwg_postgres_dev psql -U pwg -d pwg_dev -c "select id, email, role from users;"
```
Expected: one row.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/seed.ts apps/api/package.json
git commit -m "feat(api): prisma seed with dev admin"
```


## Phase 3 — Auth backend

### Task 3.1: Install auth-related dependencies

**Files:** _(package only)_

- [ ] **Step 1: Install**

```bash
npm -w apps/api i firebase-admin argon2 @nestjs/swagger @nestjs/config class-validator class-transformer reflect-metadata
npm -w apps/api i -D @types/node supertest @types/supertest testcontainers @testcontainers/postgresql
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json apps/api/package.json
git commit -m "chore(api): install auth + swagger + testcontainers deps"
```

### Task 3.2: Config module + Firebase Admin singleton

**Files:**
- Create: `apps/api/src/config/env.validation.ts`
- Create: `apps/api/src/firebase/firebase.service.ts`
- Create: `apps/api/src/firebase/firebase.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Env validation**

`apps/api/src/config/env.validation.ts`:
```ts
import { plainToInstance } from 'class-transformer';
import { IsIn, IsOptional, IsString, validateSync } from 'class-validator';

export class EnvVars {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV!: 'development' | 'test' | 'production';

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  PORT?: string;

  @IsString()
  @IsOptional()
  ALLOWED_ORIGINS?: string;

  @IsString()
  @IsOptional()
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(`Invalid env: ${errors.toString()}`);
  }
  return validated;
}
```

- [ ] **Step 2: Firebase service**

`apps/api/src/firebase/firebase.service.ts`:
```ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!raw) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set; Firebase auth disabled');
      return;
    }
    const creds = JSON.parse(raw) as admin.ServiceAccount;
    this.app = admin.initializeApp({ credential: admin.credential.cert(creds) });
  }

  async verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
    if (!this.app) throw new Error('Firebase not initialized');
    return this.app.auth().verifyIdToken(token);
  }
}
```

- [ ] **Step 3: Firebase module**

`apps/api/src/firebase/firebase.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

@Module({
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
```

- [ ] **Step 4: Wire into AppModule**

`apps/api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { FirebaseModule } from './firebase/firebase.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    FirebaseModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 5: Run**

`npm run dev:api`
Expected: warn log `FIREBASE_SERVICE_ACCOUNT_JSON not set` (ok for now). Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): config validation + firebase module"
```

### Task 3.3: Prisma module

**Files:**
- Create: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/src/prisma/prisma.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Prisma service**

`apps/api/src/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Prisma module**

`apps/api/src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Register**

Add `PrismaModule` to `imports` in `apps/api/src/app.module.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/prisma apps/api/src/app.module.ts
git commit -m "feat(api): global prisma module"
```

### Task 3.4: AuthGuard (Firebase strategy) — test first

**Files:**
- Create: `apps/api/src/auth/auth.guard.ts`
- Create: `apps/api/src/auth/auth.guard.spec.ts`

- [ ] **Step 1: Write failing test**

`apps/api/src/auth/auth.guard.spec.ts`:
```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';

const ctx = (auth: string | undefined): ExecutionContext => ({
  switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: auth }, user: undefined }) }),
} as unknown as ExecutionContext);

describe('AuthGuard (firebase path)', () => {
  it('rejects request with no Authorization header', async () => {
    const firebase = { verifyIdToken: jest.fn() } as unknown as FirebaseService;
    const prisma = { user: { findUnique: jest.fn() }, apiKey: { findFirst: jest.fn() } } as unknown as PrismaService;
    const guard = new AuthGuard(firebase, prisma);

    await expect(guard.canActivate(ctx(undefined))).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid Firebase ID token and attaches user', async () => {
    const firebase = {
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'fb-uid-1', email: 'x@y.z' }),
    } as unknown as FirebaseService;
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 10n, firebaseUid: 'fb-uid-1', role: 'member' }) },
      apiKey: { findFirst: jest.fn() },
    } as unknown as PrismaService;
    const req = { headers: { authorization: 'Bearer good-token' }, user: undefined } as any;
    const guard = new AuthGuard(firebase, prisma);

    const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
    const ok = await guard.canActivate(context);
    expect(ok).toBe(true);
    expect(req.user).toMatchObject({ id: 10n, firebaseUid: 'fb-uid-1' });
  });
});
```

- [ ] **Step 2: Run the failing test**

`npm -w apps/api run test -- --testPathPattern auth.guard`
Expected: compile error "Cannot find module './auth.guard'".

- [ ] **Step 3: Implement minimal guard**

`apps/api/src/auth/auth.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthUser {
  id: bigint;
  firebaseUid: string | null;
  role: 'admin' | 'pm' | 'member';
  via: 'firebase' | 'api_key';
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer token');
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException('empty token');

    const firebaseUser = await this.tryFirebase(token);
    if (firebaseUser) {
      req.user = firebaseUser;
      return true;
    }
    const apiKeyUser = await this.tryApiKey(token);
    if (apiKeyUser) {
      req.user = apiKeyUser;
      return true;
    }
    throw new UnauthorizedException('invalid token');
  }

  private async tryFirebase(token: string): Promise<AuthUser | null> {
    try {
      const decoded = await this.firebase.verifyIdToken(token);
      const user = await this.prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
      if (!user) return null;
      return { id: user.id, firebaseUid: user.firebaseUid, role: user.role as AuthUser['role'], via: 'firebase' };
    } catch {
      return null;
    }
  }

  private async tryApiKey(token: string): Promise<AuthUser | null> {
    // Argon2 verify requires hash-first, so iterate candidate rows via prefix (8 chars).
    const prefix = token.slice(0, Math.min(8, token.length));
    const candidates = await this.prisma.apiKey.findMany({
      where: { prefix, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { user: true },
    });
    for (const cand of candidates) {
      if (await argon2.verify(cand.keyHash, token)) {
        await this.prisma.apiKey.update({ where: { id: cand.id }, data: { lastUsedAt: new Date() } });
        return { id: cand.user.id, firebaseUid: cand.user.firebaseUid, role: cand.user.role as AuthUser['role'], via: 'api_key' };
      }
    }
    return null;
  }
}
```

- [ ] **Step 4: Re-run tests**

`npm -w apps/api run test -- --testPathPattern auth.guard`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth
git commit -m "feat(api): AuthGuard with Firebase + api-key strategies"
```

### Task 3.5: RolesGuard + `@Roles`

**Files:**
- Create: `apps/api/src/auth/roles.decorator.ts`
- Create: `apps/api/src/auth/roles.guard.ts`
- Create: `apps/api/src/auth/roles.guard.spec.ts`

- [ ] **Step 1: Decorator**

`apps/api/src/auth/roles.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type GlobalRole = 'admin' | 'pm' | 'member';
export const Roles = (...roles: GlobalRole[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 2: Failing test**

`apps/api/src/auth/roles.guard.spec.ts`:
```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const ctxFor = (user: any, roles: string[] | undefined) => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(roles) } as unknown as Reflector;
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
    return { guard: new RolesGuard(reflector), context };
  };

  it('allows when no roles metadata', async () => {
    const { guard, context } = ctxFor({ role: 'member' }, undefined);
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('rejects when role not in allowed list', async () => {
    const { guard, context } = ctxFor({ role: 'member' }, ['admin']);
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows when role in allowed list', async () => {
    const { guard, context } = ctxFor({ role: 'pm' }, ['admin', 'pm']);
    expect(await guard.canActivate(context)).toBe(true);
  });
});
```

- [ ] **Step 3: Run, expect compile fail**

`npm -w apps/api run test -- --testPathPattern roles.guard`

- [ ] **Step 4: Implement**

`apps/api/src/auth/roles.guard.ts`:
```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, GlobalRole } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<GlobalRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest<{ user?: { role?: GlobalRole } }>();
    const role = req.user?.role;
    if (!role || !required.includes(role)) throw new ForbiddenException('role not allowed');
    return true;
  }
}
```

- [ ] **Step 5: Re-run tests**

All pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth
git commit -m "feat(api): RolesGuard + @Roles decorator"
```

### Task 3.6: ProjectMembershipGuard + `@RequireProject`

**Files:**
- Create: `apps/api/src/auth/require-project.decorator.ts`
- Create: `apps/api/src/auth/project-membership.guard.ts`
- Create: `apps/api/src/auth/project-membership.guard.spec.ts`

- [ ] **Step 1: Decorator**

`apps/api/src/auth/require-project.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PROJECT_KEY = 'requireProject';
export const RequireProject = (paramName = 'id') => SetMetadata(REQUIRE_PROJECT_KEY, paramName);
```

- [ ] **Step 2: Failing test**

`apps/api/src/auth/project-membership.guard.spec.ts`:
```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectMembershipGuard } from './project-membership.guard';
import { PrismaService } from '../prisma/prisma.service';

const buildCtx = (user: any, params: any, param: string | undefined) => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(param) } as unknown as Reflector;
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
  } as unknown as ExecutionContext;
  return { reflector, ctx };
};

describe('ProjectMembershipGuard', () => {
  it('allows when no metadata', async () => {
    const { reflector, ctx } = buildCtx({ id: 1n, role: 'member' }, { id: '5' }, undefined);
    const prisma = {} as PrismaService;
    expect(await new ProjectMembershipGuard(reflector, prisma).canActivate(ctx)).toBe(true);
  });

  it('allows admin always', async () => {
    const { reflector, ctx } = buildCtx({ id: 1n, role: 'admin' }, { id: '5' }, 'id');
    const prisma = { project: { findUnique: jest.fn() }, projectMember: { findUnique: jest.fn() } } as unknown as PrismaService;
    expect(await new ProjectMembershipGuard(reflector, prisma).canActivate(ctx)).toBe(true);
  });

  it('allows owner', async () => {
    const { reflector, ctx } = buildCtx({ id: 7n, role: 'member' }, { id: '5' }, 'id');
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ ownerId: 7n }) },
      projectMember: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    expect(await new ProjectMembershipGuard(reflector, prisma).canActivate(ctx)).toBe(true);
  });

  it('allows project member', async () => {
    const { reflector, ctx } = buildCtx({ id: 8n, role: 'member' }, { id: '5' }, 'id');
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ ownerId: 1n }) },
      projectMember: { findUnique: jest.fn().mockResolvedValue({ userId: 8n }) },
    } as unknown as PrismaService;
    expect(await new ProjectMembershipGuard(reflector, prisma).canActivate(ctx)).toBe(true);
  });

  it('forbids non-member', async () => {
    const { reflector, ctx } = buildCtx({ id: 9n, role: 'member' }, { id: '5' }, 'id');
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ ownerId: 1n }) },
      projectMember: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(new ProjectMembershipGuard(reflector, prisma).canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 3: Implement**

`apps/api/src/auth/project-membership.guard.ts`:
```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRE_PROJECT_KEY } from './require-project.decorator';

@Injectable()
export class ProjectMembershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_PROJECT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!paramName) return true;
    const req = context.switchToHttp().getRequest<{ user?: { id: bigint; role: string }; params: Record<string, string> }>();
    if (req.user?.role === 'admin') return true;
    const raw = req.params[paramName];
    if (!raw) throw new ForbiddenException('missing project param');
    const projectId = BigInt(raw);
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('project not found');
    if (project.ownerId === req.user?.id) return true;
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user!.id } },
    });
    if (!membership) throw new ForbiddenException('not a project member');
    return true;
  }
}
```

- [ ] **Step 4: Tests pass**

`npm -w apps/api run test -- --testPathPattern project-membership`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth
git commit -m "feat(api): ProjectMembershipGuard + @RequireProject"
```

### Task 3.7: Global auth wiring + `POST /v1/auth/sync` + `GET /v1/users/me`

**Files:**
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/auth.service.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/auth/current-user.decorator.ts`
- Create: `apps/api/src/users/users.controller.ts`
- Create: `apps/api/src/users/users.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: `CurrentUser` decorator**

`apps/api/src/auth/current-user.decorator.ts`:
```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from './auth.guard';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
```

- [ ] **Step 2: Auth service**

`apps/api/src/auth/auth.service.ts`:
```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly firebase: FirebaseService, private readonly prisma: PrismaService) {}

  async syncFromToken(token: string) {
    const decoded = await this.firebase.verifyIdToken(token).catch(() => {
      throw new UnauthorizedException('invalid id token');
    });
    const user = await this.prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: {
        email: decoded.email ?? undefined,
        displayName: decoded.name ?? decoded.email ?? 'User',
        avatarUrl: decoded.picture ?? undefined,
      },
      create: {
        firebaseUid: decoded.uid,
        email: decoded.email ?? `${decoded.uid}@unknown.local`,
        displayName: decoded.name ?? decoded.email ?? 'User',
        avatarUrl: decoded.picture ?? undefined,
        role: 'member',
      },
    });
    return user;
  }
}
```

- [ ] **Step 3: Auth controller**

`apps/api/src/auth/auth.controller.ts`:
```ts
import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('sync')
  async sync(@Headers('authorization') authHeader?: string) {
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer token');
    const token = authHeader.slice('Bearer '.length).trim();
    const user = await this.auth.syncFromToken(token);
    return {
      id: user.id.toString(),
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  }
}
```

- [ ] **Step 4: Auth module**

`apps/api/src/auth/auth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { ProjectMembershipGuard } from './project-membership.guard';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard, ProjectMembershipGuard],
  exports: [AuthGuard, RolesGuard, ProjectMembershipGuard],
})
export class AuthModule {}
```

- [ ] **Step 5: Users controller/module (me endpoint)**

`apps/api/src/users/users.controller.ts`:
```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const full = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return {
      id: full.id.toString(),
      email: full.email,
      displayName: full.displayName,
      role: full.role,
      avatarUrl: full.avatarUrl,
    };
  }
}
```

`apps/api/src/users/users.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
})
export class UsersModule {}
```

- [ ] **Step 6: URI versioning + CORS in `main.ts`**

`apps/api/src/main.ts`:
```ts
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({
    origin: (config.get<string>('ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);
}
bootstrap();
```

- [ ] **Step 7: Register modules**

In `apps/api/src/app.module.ts`, add `AuthModule`, `UsersModule` to imports.

- [ ] **Step 8: E2E smoke test (optional at this stage)**

With `FIREBASE_SERVICE_ACCOUNT_JSON` unset, the token path will throw — that's expected. Manual smoke via `curl`:
```bash
curl -sf -X POST http://localhost:3000/v1/auth/sync
```
Expected: HTTP 401 `{ "statusCode": 401, ... }` (auth header missing).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): auth/sync + users/me endpoints with URI versioning"
```

### Task 3.8: Swagger UI

**Files:**
- Modify: `apps/api/src/main.ts`
- Create: `apps/api/src/cli/dump-openapi.ts`
- Create: `apps/api/src/cli/check-openapi.ts`
- Create: `apps/api/openapi.json` (generated, committed)

- [ ] **Step 1: Add swagger bootstrap helper**

Create `apps/api/src/swagger.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Project-Workgroup API')
    .setVersion('1')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT/APIKey' }, 'bearer')
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function mountSwagger(app: INestApplication): OpenAPIObject {
  const doc = buildOpenApiDocument(app);
  SwaggerModule.setup('v1/docs', app, doc, { jsonDocumentUrl: 'v1/openapi.json' });
  return doc;
}
```

- [ ] **Step 2: Call `mountSwagger` in `main.ts`**

Insert before `app.listen`:
```ts
import { mountSwagger } from './swagger';
// ...
mountSwagger(app);
```

- [ ] **Step 3: Dump CLI**

`apps/api/src/cli/dump-openapi.ts`:
```ts
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from '../swagger';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const doc = buildOpenApiDocument(app);
  writeFileSync('openapi.json', JSON.stringify(doc, null, 2));
  await app.close();
  console.log('wrote apps/api/openapi.json');
}
main();
```

- [ ] **Step 4: Check CLI**

`apps/api/src/cli/check-openapi.ts`:
```ts
import { NestFactory } from '@nestjs/core';
import { readFileSync } from 'node:fs';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from '../swagger';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const fresh = JSON.stringify(buildOpenApiDocument(app), null, 2);
  await app.close();
  const committed = readFileSync('openapi.json', 'utf8').trim();
  if (fresh.trim() !== committed) {
    console.error('OpenAPI drift: run "npm run api:openapi:dump" and commit the result.');
    process.exit(1);
  }
  console.log('OpenAPI in sync.');
}
main();
```

- [ ] **Step 5: Generate first spec and commit**

```bash
npm run api:openapi:dump
```
Expected: `apps/api/openapi.json` created.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/swagger.ts apps/api/src/cli apps/api/openapi.json
git commit -m "feat(api): swagger UI + openapi dump/check CLIs"
```


## Phase 4 — CRUD modules

**Order:** users → projects → project_members → tasks → task_links → workload. Each module publishes its DTOs to `packages/shared` before the backend imports them, so the frontend can consume the same types later.

All modules share these conventions:
- Controllers decorated with `@UseGuards(AuthGuard)` + `@ApiBearerAuth()`.
- `BigInt` IDs are serialized as decimal strings in responses (Nest's built-in serializer will throw on raw BigInt — use a global interceptor).
- Paginated lists use `{ items: [...], nextCursor: string | null }`.

### Task 4.0: BigInt serialization interceptor

**Files:**
- Create: `apps/api/src/common/bigint-serializer.interceptor.ts`
- Create: `apps/api/src/common/bigint-serializer.interceptor.spec.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Failing test**

`apps/api/src/common/bigint-serializer.interceptor.spec.ts`:
```ts
import { lastValueFrom, of } from 'rxjs';
import { BigIntSerializerInterceptor } from './bigint-serializer.interceptor';

describe('BigIntSerializerInterceptor', () => {
  it('converts bigint fields to strings recursively', async () => {
    const interceptor = new BigIntSerializerInterceptor();
    const ctx = {} as any;
    const handler = { handle: () => of({ id: 10n, nested: { id: 20n, arr: [{ id: 30n }] } }) };
    const result = await lastValueFrom(interceptor.intercept(ctx, handler));
    expect(result).toEqual({ id: '10', nested: { id: '20', arr: [{ id: '30' }] } });
  });
});
```

- [ ] **Step 2: Implement**

`apps/api/src/common/bigint-serializer.interceptor.ts`:
```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

function convert(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(convert);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = convert(v);
    }
    return out;
  }
  return value;
}

@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(convert));
  }
}
```

- [ ] **Step 3: Register globally**

In `apps/api/src/main.ts`, before `app.listen`:
```ts
import { BigIntSerializerInterceptor } from './common/bigint-serializer.interceptor';
// ...
app.useGlobalInterceptors(new BigIntSerializerInterceptor());
```

- [ ] **Step 4: Tests pass**

`npm -w apps/api run test -- --testPathPattern bigint-serializer`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): global bigint serializer interceptor"
```

### Task 4.1: Users module (list + search + by id)

**Files:**
- Create: `packages/shared/src/dto/user.dto.ts`
- Create: `packages/shared/src/index.ts` (update)
- Create: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/users/users.controller.ts`
- Modify: `apps/api/src/users/users.module.ts`
- Create: `apps/api/test/users.e2e-spec.ts`

- [ ] **Step 1: Shared DTOs**

`packages/shared/src/dto/user.dto.ts`:
```ts
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class SearchUsersQueryDto {
  @IsOptional() @IsString() @MinLength(1)
  search?: string;

  @IsOptional() @IsInt() @Min(1)
  limit?: number;

  @IsOptional() @IsString()
  cursor?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'pm' | 'member';
  avatarUrl: string | null;
}

export interface PagedResponse<T> {
  items: T[];
  nextCursor: string | null;
}
```

Update `packages/shared/src/index.ts`:
```ts
export * from './dto/user.dto';
```

- [ ] **Step 2: Users service**

`apps/api/src/users/users.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: { search?: string; limit?: number; cursor?: string }) {
    const take = Math.min(params.limit ?? 25, 100);
    const where = params.search
      ? { OR: [{ email: { contains: params.search, mode: 'insensitive' as const } }, { displayName: { contains: params.search, mode: 'insensitive' as const } }] }
      : {};
    const cursor = params.cursor ? { id: BigInt(params.cursor) } : undefined;
    const rows = await this.prisma.user.findMany({
      where,
      take: take + 1,
      cursor,
      skip: cursor ? 1 : 0,
      orderBy: { id: 'asc' },
    });
    const hasMore = rows.length > take;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((u) => ({
      id: u.id.toString(),
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      avatarUrl: u.avatarUrl,
    }));
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }
}
```

- [ ] **Step 3: Controller**

Update `apps/api/src/users/users.controller.ts`:
```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SearchUsersQueryDto } from '@project-workgroup/shared';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly prisma: PrismaService, private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const full = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return {
      id: full.id.toString(),
      email: full.email,
      displayName: full.displayName,
      role: full.role,
      avatarUrl: full.avatarUrl,
    };
  }

  @Get()
  async search(@Query() q: SearchUsersQueryDto) {
    return this.users.search(q);
  }
}
```

Update `apps/api/src/users/users.module.ts` to register `UsersService`.

- [ ] **Step 4: E2E test harness**

Create `apps/api/test/e2e-setup.ts`:
```ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { BigIntSerializerInterceptor } from '../src/common/bigint-serializer.interceptor';

export interface E2EHandle {
  app: INestApplication;
  container: StartedPostgreSqlContainer;
  close: () => Promise<void>;
}

export async function bootE2E(): Promise<E2EHandle> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });

  const app = await NestFactory.create(AppModule, { logger: false });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new BigIntSerializerInterceptor());
  await app.init();
  return {
    app,
    container,
    close: async () => {
      await app.close();
      await container.stop();
    },
  };
}
```

- [ ] **Step 5: E2E test — users search**

`apps/api/test/users.e2e-spec.ts`:
```ts
import * as request from 'supertest';
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Users (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;

  beforeAll(async () => {
    handle = await bootE2E();
    prisma = handle.app.get(PrismaService);
    await prisma.user.createMany({
      data: [
        { firebaseUid: 'uid-a', email: 'alice@example.com', displayName: 'Alice', role: 'member' },
        { firebaseUid: 'uid-b', email: 'bob@example.com', displayName: 'Bob', role: 'member' },
      ],
    });
  }, 120_000);

  afterAll(() => handle.close());

  it('rejects without auth header', async () => {
    const res = await request(handle.app.getHttpServer()).get('/v1/users');
    expect(res.status).toBe(401);
  });
});
```

(Full auth-happy path tests arrive once Firebase emulator is wired — for now validating the guard blocks unauthenticated traffic is enough to lock the behavior.)

Add `apps/api/test/jest-e2e.json` (Nest generated; verify `rootDir: "."` and `testRegex: ".e2e-spec.ts$"`).

- [ ] **Step 6: Run e2e**

```bash
npm -w apps/api run test:e2e -- --testPathPattern users
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared apps/api
git commit -m "feat(api): users list/search + e2e harness with testcontainers"
```

### Task 4.2: Projects module — create + list

**Files:**
- Create: `packages/shared/src/dto/project.dto.ts`
- Create: `apps/api/src/projects/projects.service.ts`
- Create: `apps/api/src/projects/projects.controller.ts`
- Create: `apps/api/src/projects/projects.module.ts`
- Create: `apps/api/test/projects.e2e-spec.ts`

- [ ] **Step 1: DTOs**

`packages/shared/src/dto/project.dto.ts`:
```ts
import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const PROJECT_STATUSES = ['planning', 'active', 'completed', 'on-hold'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

export class CreateProjectDto {
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;

  @IsIn(PROJECT_STATUSES) status!: ProjectStatus;

  @IsString() color!: string;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsIn(PROJECT_STATUSES) status?: ProjectStatus;
  @IsOptional() @IsString() color?: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  ownerId: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}
```

Export from `packages/shared/src/index.ts`.

Note: the DB enum uses `on_hold` while the DTO exposes `on-hold`. Map with a tiny helper:

`apps/api/src/projects/status.mapper.ts`:
```ts
import { ProjectStatus as PrismaProjectStatus } from '@prisma/client';
import { ProjectStatus as WireStatus } from '@project-workgroup/shared';

export const toWire = (s: PrismaProjectStatus): WireStatus => (s === 'on_hold' ? 'on-hold' : s);
export const toPrisma = (s: WireStatus): PrismaProjectStatus => (s === 'on-hold' ? 'on_hold' : s);
```

- [ ] **Step 2: Service**

`apps/api/src/projects/projects.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, ProjectResponse, UpdateProjectDto } from '@project-workgroup/shared';
import { AuthUser } from '../auth/auth.guard';
import { toPrisma, toWire } from './status.mapper';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, dto: CreateProjectDto): Promise<ProjectResponse> {
    const created = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: toPrisma(dto.status),
        ownerId: user.id,
        color: dto.color,
      },
    });
    return this.toResponse(created);
  }

  async listForUser(user: AuthUser, opts: { limit?: number; cursor?: string }): Promise<{ items: ProjectResponse[]; nextCursor: string | null }> {
    const take = Math.min(opts.limit ?? 25, 100);
    const where = user.role === 'admin'
      ? {}
      : { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] };
    const cursor = opts.cursor ? { id: BigInt(opts.cursor) } : undefined;
    const rows = await this.prisma.project.findMany({
      where,
      take: take + 1,
      cursor,
      skip: cursor ? 1 : 0,
      orderBy: { id: 'desc' },
    });
    const hasMore = rows.length > take;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((p) => this.toResponse(p));
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async getById(user: AuthUser, id: bigint): Promise<ProjectResponse> {
    const p = await this.prisma.project.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('project not found');
    return this.toResponse(p);
  }

  async update(id: bigint, dto: UpdateProjectDto): Promise<ProjectResponse> {
    const p = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status ? toPrisma(dto.status) : undefined,
        color: dto.color,
      },
    });
    return this.toResponse(p);
  }

  async remove(id: bigint): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  private toResponse(p: Awaited<ReturnType<PrismaService['project']['findUnique']>> & {}): ProjectResponse {
    if (!p) throw new Error('null project');
    return {
      id: p.id.toString(),
      name: p.name,
      description: p.description,
      startDate: p.startDate.toISOString().slice(0, 10),
      endDate: p.endDate.toISOString().slice(0, 10),
      status: toWire(p.status),
      ownerId: p.ownerId.toString(),
      color: p.color,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
```

- [ ] **Step 3: Controller**

`apps/api/src/projects/projects.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateProjectDto, UpdateProjectDto } from '@project-workgroup/shared';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireProject } from '../auth/require-project.decorator';
import { ProjectMembershipGuard } from '../auth/project-membership.guard';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.projects.listForUser(user, { limit: limit ? Number(limit) : undefined, cursor });
  }

  @Get(':id')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.getById(user, BigInt(id));
  }

  @Patch(':id')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(BigInt(id), dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('id')
  remove(@Param('id') id: string) {
    return this.projects.remove(BigInt(id));
  }
}
```

- [ ] **Step 4: Module**

`apps/api/src/projects/projects.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
```

Register in `AppModule` imports.

- [ ] **Step 5: E2E test**

`apps/api/test/projects.e2e-spec.ts` — test that CREATE with a seeded user via AuthGuard stub.

For tests we stub the AuthGuard using Nest's `overrideGuard`:
```ts
import * as request from 'supertest';
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';

describe('Projects (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let ownerId: bigint;

  beforeAll(async () => {
    handle = await bootE2E({
      overrideGuard: {
        guard: AuthGuard,
        value: {
          canActivate: (ctx: any) => {
            ctx.switchToHttp().getRequest().user = { id: ownerId, firebaseUid: 'fb-x', role: 'member', via: 'firebase' };
            return true;
          },
        },
      },
    });
    prisma = handle.app.get(PrismaService);
    const u = await prisma.user.create({ data: { firebaseUid: 'fb-x', email: 'x@y.z', displayName: 'X', role: 'member' } });
    ownerId = u.id;
  }, 120_000);

  afterAll(() => handle.close());

  it('creates a project', async () => {
    const res = await request(handle.app.getHttpServer())
      .post('/v1/projects')
      .send({ name: 'P1', startDate: '2026-01-01', endDate: '2026-02-01', status: 'planning', color: '#123' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'P1', ownerId: ownerId.toString(), status: 'planning' });
  });

  it('lists projects for the owner', async () => {
    const res = await request(handle.app.getHttpServer()).get('/v1/projects');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });
});
```

Update `apps/api/test/e2e-setup.ts` to support `overrideGuard`:
```ts
// within bootE2E signature:
export async function bootE2E(opts?: { overrideGuard?: { guard: any; value: any } }): Promise<E2EHandle> {
  // ...
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(opts?.overrideGuard?.guard ?? class Noop {})
    .useValue(opts?.overrideGuard?.value ?? { canActivate: () => true })
    .compile();
  const app = moduleRef.createNestApplication();
  // ... same pipes/interceptors
}
```
(Replace the `NestFactory.create` call with the `Test` module above. Keep migrations step.)

- [ ] **Step 6: Run tests**

`npm -w apps/api run test:e2e -- --testPathPattern projects`
Expected: PASS.

- [ ] **Step 7: Regenerate OpenAPI and commit**

```bash
npm run api:openapi:dump
git add .
git commit -m "feat(api): projects CRUD + e2e tests"
```

### Task 4.3: Project members module

**Files:**
- Create: `packages/shared/src/dto/project-member.dto.ts`
- Create: `apps/api/src/project-members/project-members.service.ts`
- Create: `apps/api/src/project-members/project-members.controller.ts`
- Create: `apps/api/src/project-members/project-members.module.ts`
- Create: `apps/api/test/project-members.e2e-spec.ts`

- [ ] **Step 1: DTOs**

`packages/shared/src/dto/project-member.dto.ts`:
```ts
import { IsIn, IsString } from 'class-validator';

export const PROJECT_ROLES = ['manager', 'contributor', 'viewer'] as const;
export type ProjectRoleName = typeof PROJECT_ROLES[number];

export class AddProjectMemberDto {
  @IsString() userId!: string;
  @IsIn(PROJECT_ROLES) projectRole!: ProjectRoleName;
}

export interface ProjectMemberResponse {
  projectId: string;
  userId: string;
  projectRole: ProjectRoleName;
  user: { id: string; email: string; displayName: string; avatarUrl: string | null };
}
```

Export from index.

- [ ] **Step 2: Service**

`apps/api/src/project-members/project-members.service.ts`:
```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddProjectMemberDto, ProjectMemberResponse } from '@project-workgroup/shared';

@Injectable()
export class ProjectMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: bigint): Promise<ProjectMemberResponse[]> {
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      projectId: r.projectId.toString(),
      userId: r.userId.toString(),
      projectRole: r.projectRole,
      user: { id: r.user.id.toString(), email: r.user.email, displayName: r.user.displayName, avatarUrl: r.user.avatarUrl },
    }));
  }

  async add(projectId: bigint, dto: AddProjectMemberDto): Promise<ProjectMemberResponse> {
    const userId = BigInt(dto.userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');
    try {
      const row = await this.prisma.projectMember.create({
        data: { projectId, userId, projectRole: dto.projectRole },
        include: { user: true },
      });
      return {
        projectId: row.projectId.toString(),
        userId: row.userId.toString(),
        projectRole: row.projectRole,
        user: { id: row.user.id.toString(), email: row.user.email, displayName: row.user.displayName, avatarUrl: row.user.avatarUrl },
      };
    } catch {
      throw new BadRequestException('already a member');
    }
  }

  async remove(projectId: bigint, userId: bigint): Promise<void> {
    await this.prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  }
}
```

- [ ] **Step 3: Controller**

```ts
import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AddProjectMemberDto } from '@project-workgroup/shared';
import { AuthGuard } from '../auth/auth.guard';
import { ProjectMembershipGuard } from '../auth/project-membership.guard';
import { RequireProject } from '../auth/require-project.decorator';
import { ProjectMembersService } from './project-members.service';

@ApiTags('project-members')
@ApiBearerAuth()
@UseGuards(AuthGuard, ProjectMembershipGuard)
@RequireProject('projectId')
@Controller({ path: 'projects/:projectId/members', version: '1' })
export class ProjectMembersController {
  constructor(private readonly svc: ProjectMembersService) {}

  @Get()
  list(@Param('projectId') id: string) {
    return this.svc.list(BigInt(id));
  }

  @Post()
  add(@Param('projectId') id: string, @Body() dto: AddProjectMemberDto) {
    return this.svc.add(BigInt(id), dto);
  }

  @Delete(':userId')
  @HttpCode(204)
  remove(@Param('projectId') id: string, @Param('userId') userId: string) {
    return this.svc.remove(BigInt(id), BigInt(userId));
  }
}
```

- [ ] **Step 4: Module + register in AppModule**

- [ ] **Step 5: E2E test**

`apps/api/test/project-members.e2e-spec.ts` covers: add member, list shows them, add duplicate → 400, delete returns 204.

(Full test body identical to pattern in Task 4.2 — create owner user + project in beforeAll, then hit endpoints.)

- [ ] **Step 6: Tests pass + commit**

```bash
npm -w apps/api run test:e2e -- --testPathPattern project-members
npm run api:openapi:dump
git add .
git commit -m "feat(api): project members module"
```

### Task 4.4: Tasks module (CRUD + progress + fractional order)

**Files:**
- Create: `packages/shared/src/dto/task.dto.ts`
- Create: `apps/api/src/tasks/fractional-index.ts`
- Create: `apps/api/src/tasks/fractional-index.spec.ts`
- Create: `apps/api/src/tasks/tasks.service.ts`
- Create: `apps/api/src/tasks/tasks.controller.ts`
- Create: `apps/api/src/tasks/tasks.module.ts`
- Create: `apps/api/test/tasks.e2e-spec.ts`

- [ ] **Step 1: Fractional index helper — failing test**

`apps/api/src/tasks/fractional-index.spec.ts`:
```ts
import { fractionalBetween } from './fractional-index';

describe('fractionalBetween', () => {
  it('returns midpoint when both provided', () => {
    expect(fractionalBetween('1', '3')).toBe('2');
  });
  it('returns value after last when only before provided', () => {
    const r = fractionalBetween('10', null);
    expect(Number(r)).toBeGreaterThan(10);
  });
  it('returns value before first when only after provided', () => {
    const r = fractionalBetween(null, '10');
    expect(Number(r)).toBeLessThan(10);
  });
  it('handles equal-density midpoint', () => {
    const m = fractionalBetween('1', '2');
    expect(Number(m)).toBeGreaterThan(1);
    expect(Number(m)).toBeLessThan(2);
  });
});
```

- [ ] **Step 2: Implement**

`apps/api/src/tasks/fractional-index.ts`:
```ts
export function fractionalBetween(before: string | null, after: string | null): string {
  if (before && after) {
    const b = Number(before);
    const a = Number(after);
    return ((b + a) / 2).toString();
  }
  if (before) return (Number(before) + 1024).toString();
  if (after) return (Number(after) - 1024).toString();
  return '1024';
}
```

- [ ] **Step 3: Run tests**

`npm -w apps/api run test -- --testPathPattern fractional-index`
Expected: PASS.

- [ ] **Step 4: Task DTOs**

`packages/shared/src/dto/task.dto.ts`:
```ts
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export const TASK_STATUSES = ['not-started', 'in-progress', 'completed', 'blocked'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const TASK_TYPES = ['task', 'summary', 'milestone'] as const;

export type TaskStatus = typeof TASK_STATUSES[number];
export type TaskPriority = typeof TASK_PRIORITIES[number];
export type TaskType = typeof TASK_TYPES[number];

export class CreateTaskDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsNumber() duration!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsIn(TASK_PRIORITIES) priority!: TaskPriority;
  @IsIn(TASK_STATUSES) status!: TaskStatus;
  @IsIn(TASK_TYPES) type!: TaskType;
  @IsString() color!: string;
  @IsOptional() @IsBoolean() open?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsNumber() estimatedHours?: number;
  @IsOptional() @IsString() beforeTaskId?: string; // for initial order positioning
  @IsOptional() @IsString() afterTaskId?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsNumber() duration?: number;
  @IsOptional() @IsString() assigneeId?: string | null;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsIn(TASK_PRIORITIES) priority?: TaskPriority;
  @IsOptional() @IsIn(TASK_STATUSES) status?: TaskStatus;
  @IsOptional() @IsIn(TASK_TYPES) type?: TaskType;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsBoolean() open?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsNumber() estimatedHours?: number;
  @IsOptional() @IsNumber() actualHours?: number | null;
}

export class UpdateProgressDto {
  @IsInt() @Min(0) @Max(100) progress!: number;
}

export class UpdateOrderDto {
  @IsOptional() @IsString() beforeTaskId?: string;
  @IsOptional() @IsString() afterTaskId?: string;
  @IsOptional() @IsString() parentId?: string | null;
}

export interface TaskResponse {
  id: string;
  projectId: string;
  parentId: string | null;
  assigneeId: string | null;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  duration: number;
  progress: number;
  priority: TaskPriority;
  status: TaskStatus;
  type: TaskType;
  color: string;
  order: number;
  open: boolean;
  tags: string[];
  estimatedHours: number;
  actualHours: number | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 5: Status/type wire mappers**

Add to `apps/api/src/tasks/wire.ts`:
```ts
import { TaskStatus as PS, TaskType as PT, TaskPriority as PP } from '@prisma/client';
import { TaskStatus, TaskType, TaskPriority } from '@project-workgroup/shared';

export const toWireStatus = (s: PS): TaskStatus => s.replace('_', '-') as TaskStatus;
export const toPrismaStatus = (s: TaskStatus): PS => s.replace('-', '_') as PS;
export const toWireType = (t: PT): TaskType => t as TaskType;
export const toPrismaType = (t: TaskType): PT => t as PT;
export const toWirePriority = (p: PP): TaskPriority => p as TaskPriority;
export const toPrismaPriority = (p: TaskPriority): PP => p as PP;
```

- [ ] **Step 6: Service**

`apps/api/src/tasks/tasks.service.ts`:
```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, TaskResponse, UpdateOrderDto, UpdateProgressDto, UpdateTaskDto } from '@project-workgroup/shared';
import { fractionalBetween } from './fractional-index';
import { toPrismaPriority, toPrismaStatus, toPrismaType, toWirePriority, toWireStatus, toWireType } from './wire';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: bigint): Promise<TaskResponse[]> {
    const rows = await this.prisma.task.findMany({
      where: { projectId },
      orderBy: [{ parentId: 'asc' }, { order: 'asc' }],
    });
    return rows.map((r) => this.toResponse(r));
  }

  async get(id: bigint): Promise<TaskResponse> {
    const r = await this.prisma.task.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('task not found');
    return this.toResponse(r);
  }

  async create(projectId: bigint, dto: CreateTaskDto): Promise<TaskResponse> {
    const [before, after] = await this.resolveNeighborOrders(projectId, dto.parentId ? BigInt(dto.parentId) : null, dto.beforeTaskId, dto.afterTaskId);
    const order = fractionalBetween(before, after);
    const created = await this.prisma.task.create({
      data: {
        projectId,
        parentId: dto.parentId ? BigInt(dto.parentId) : null,
        assigneeId: dto.assigneeId ? BigInt(dto.assigneeId) : null,
        name: dto.name,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        duration: dto.duration as any,
        progress: dto.progress ?? 0,
        priority: toPrismaPriority(dto.priority),
        status: toPrismaStatus(dto.status),
        type: toPrismaType(dto.type),
        color: dto.color,
        order: order as any,
        open: dto.open ?? true,
        tags: dto.tags ?? [],
        estimatedHours: (dto.estimatedHours ?? 0) as any,
      },
    });
    return this.toResponse(created);
  }

  async update(id: bigint, dto: UpdateTaskDto): Promise<TaskResponse> {
    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        duration: dto.duration as any,
        assigneeId: dto.assigneeId === null ? null : dto.assigneeId ? BigInt(dto.assigneeId) : undefined,
        parentId: dto.parentId === null ? null : dto.parentId ? BigInt(dto.parentId) : undefined,
        priority: dto.priority ? toPrismaPriority(dto.priority) : undefined,
        status: dto.status ? toPrismaStatus(dto.status) : undefined,
        type: dto.type ? toPrismaType(dto.type) : undefined,
        color: dto.color,
        open: dto.open,
        tags: dto.tags,
        estimatedHours: dto.estimatedHours as any,
        actualHours: dto.actualHours === null ? null : (dto.actualHours as any),
      },
    });
    return this.toResponse(updated);
  }

  async updateProgress(id: bigint, dto: UpdateProgressDto): Promise<TaskResponse> {
    const updated = await this.prisma.task.update({ where: { id }, data: { progress: dto.progress } });
    return this.toResponse(updated);
  }

  async updateOrder(id: bigint, dto: UpdateOrderDto): Promise<TaskResponse> {
    const task = await this.prisma.task.findUniqueOrThrow({ where: { id } });
    const parentId = dto.parentId === undefined ? task.parentId : dto.parentId === null ? null : BigInt(dto.parentId);
    const [before, after] = await this.resolveNeighborOrders(task.projectId, parentId, dto.beforeTaskId, dto.afterTaskId);
    const order = fractionalBetween(before, after);
    const updated = await this.prisma.task.update({ where: { id }, data: { parentId, order: order as any } });
    return this.toResponse(updated);
  }

  async remove(id: bigint): Promise<void> {
    await this.prisma.task.delete({ where: { id } });
  }

  private async resolveNeighborOrders(
    projectId: bigint,
    parentId: bigint | null,
    beforeTaskId?: string,
    afterTaskId?: string,
  ): Promise<[string | null, string | null]> {
    const loadOrder = async (raw?: string): Promise<string | null> => {
      if (!raw) return null;
      const t = await this.prisma.task.findUnique({ where: { id: BigInt(raw) } });
      if (!t || t.projectId !== projectId) throw new BadRequestException('neighbor task not in project');
      return (t.order as unknown as { toString(): string }).toString();
    };
    if (beforeTaskId || afterTaskId) {
      return [await loadOrder(beforeTaskId), await loadOrder(afterTaskId)];
    }
    // default: append to end within parent
    const last = await this.prisma.task.findFirst({
      where: { projectId, parentId },
      orderBy: { order: 'desc' },
    });
    return [last ? (last.order as unknown as { toString(): string }).toString() : null, null];
  }

  private toResponse(r: any): TaskResponse {
    return {
      id: r.id.toString(),
      projectId: r.projectId.toString(),
      parentId: r.parentId ? r.parentId.toString() : null,
      assigneeId: r.assigneeId ? r.assigneeId.toString() : null,
      name: r.name,
      description: r.description,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      duration: Number(r.duration),
      progress: r.progress,
      priority: toWirePriority(r.priority),
      status: toWireStatus(r.status),
      type: toWireType(r.type),
      color: r.color,
      order: Number(r.order),
      open: r.open,
      tags: r.tags,
      estimatedHours: Number(r.estimatedHours),
      actualHours: r.actualHours === null ? null : Number(r.actualHours),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
```

- [ ] **Step 7: Controller**

`apps/api/src/tasks/tasks.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateTaskDto, UpdateOrderDto, UpdateProgressDto, UpdateTaskDto } from '@project-workgroup/shared';
import { AuthGuard } from '../auth/auth.guard';
import { ProjectMembershipGuard } from '../auth/project-membership.guard';
import { RequireProject } from '../auth/require-project.decorator';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: '1' })
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('projects/:projectId/tasks')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  list(@Param('projectId') id: string) {
    return this.tasks.list(BigInt(id));
  }

  @Post('projects/:projectId/tasks')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  create(@Param('projectId') id: string, @Body() dto: CreateTaskDto) {
    return this.tasks.create(BigInt(id), dto);
  }

  @Get('tasks/:id') get(@Param('id') id: string) { return this.tasks.get(BigInt(id)); }
  @Patch('tasks/:id') update(@Param('id') id: string, @Body() dto: UpdateTaskDto) { return this.tasks.update(BigInt(id), dto); }
  @Delete('tasks/:id') @HttpCode(204) remove(@Param('id') id: string) { return this.tasks.remove(BigInt(id)); }

  @Patch('tasks/:id/progress') progress(@Param('id') id: string, @Body() dto: UpdateProgressDto) { return this.tasks.updateProgress(BigInt(id), dto); }
  @Patch('tasks/:id/order') order(@Param('id') id: string, @Body() dto: UpdateOrderDto) { return this.tasks.updateOrder(BigInt(id), dto); }
}
```

- [ ] **Step 8: Module + register**

- [ ] **Step 9: E2E — create, list ordering, reorder**

`apps/api/test/tasks.e2e-spec.ts`: create three tasks, verify `order` strictly increasing, reorder middle to end, verify order.

- [ ] **Step 10: Tests pass + commit**

```bash
npm -w apps/api run test:e2e -- --testPathPattern tasks
npm run api:openapi:dump
git add .
git commit -m "feat(api): tasks CRUD, progress, fractional reordering"
```

### Task 4.5: Task links module with cycle detection

**Files:**
- Create: `packages/shared/src/dto/task-link.dto.ts`
- Create: `apps/api/src/task-links/cycle-detector.ts`
- Create: `apps/api/src/task-links/cycle-detector.spec.ts`
- Create: `apps/api/src/task-links/task-links.service.ts`
- Create: `apps/api/src/task-links/task-links.controller.ts`
- Create: `apps/api/src/task-links/task-links.module.ts`
- Create: `apps/api/test/task-links.e2e-spec.ts`

- [ ] **Step 1: Cycle detector — failing test**

`apps/api/src/task-links/cycle-detector.spec.ts`:
```ts
import { detectCycle } from './cycle-detector';

describe('detectCycle', () => {
  it('no cycle with empty graph', () => {
    expect(detectCycle([], 1n, 2n)).toBe(false);
  });
  it('detects direct cycle', () => {
    const edges = [{ source: 2n, target: 1n }];
    expect(detectCycle(edges, 1n, 2n)).toBe(true);
  });
  it('detects indirect cycle', () => {
    const edges = [
      { source: 2n, target: 3n },
      { source: 3n, target: 1n },
    ];
    expect(detectCycle(edges, 1n, 2n)).toBe(true);
  });
  it('allows unrelated edges', () => {
    const edges = [{ source: 5n, target: 6n }];
    expect(detectCycle(edges, 1n, 2n)).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

`apps/api/src/task-links/cycle-detector.ts`:
```ts
export function detectCycle(
  existing: { source: bigint; target: bigint }[],
  newSource: bigint,
  newTarget: bigint,
): boolean {
  // Adding newSource -> newTarget. A cycle exists iff there's already a path from newTarget -> newSource.
  const adj = new Map<bigint, bigint[]>();
  for (const e of existing) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  const stack = [newTarget];
  const visited = new Set<bigint>();
  while (stack.length) {
    const node = stack.pop()!;
    if (node === newSource) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const next = adj.get(node) ?? [];
    for (const n of next) stack.push(n);
  }
  return false;
}
```

- [ ] **Step 3: Tests pass**

- [ ] **Step 4: DTOs**

`packages/shared/src/dto/task-link.dto.ts`:
```ts
import { IsIn, IsOptional, IsString } from 'class-validator';

export const LINK_TYPES = ['e2s', 's2s', 'e2e', 's2e'] as const;
export type TaskLinkType = typeof LINK_TYPES[number];

export class CreateTaskLinkDto {
  @IsString() sourceTaskId!: string;
  @IsString() targetTaskId!: string;
  @IsIn(LINK_TYPES) type!: TaskLinkType;
}

export class UpdateTaskLinkDto {
  @IsOptional() @IsIn(LINK_TYPES) type?: TaskLinkType;
}

export interface TaskLinkResponse {
  id: string;
  projectId: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: TaskLinkType;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 5: Service (uses cycle detector in a transaction)**

`apps/api/src/task-links/task-links.service.ts`:
```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskLinkDto, TaskLinkResponse, UpdateTaskLinkDto } from '@project-workgroup/shared';
import { detectCycle } from './cycle-detector';

@Injectable()
export class TaskLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: bigint): Promise<TaskLinkResponse[]> {
    const rows = await this.prisma.taskLink.findMany({ where: { projectId } });
    return rows.map((r) => this.toResponse(r));
  }

  async create(projectId: bigint, dto: CreateTaskLinkDto): Promise<TaskLinkResponse> {
    const source = BigInt(dto.sourceTaskId);
    const target = BigInt(dto.targetTaskId);
    if (source === target) throw new BadRequestException('source and target are identical');
    return this.prisma.$transaction(async (tx) => {
      const [src, tgt] = await Promise.all([
        tx.task.findUnique({ where: { id: source } }),
        tx.task.findUnique({ where: { id: target } }),
      ]);
      if (!src || !tgt) throw new NotFoundException('source or target task missing');
      if (src.projectId !== projectId || tgt.projectId !== projectId) throw new BadRequestException('tasks belong to another project');

      const existing = await tx.taskLink.findMany({
        where: { projectId },
        select: { sourceTaskId: true, targetTaskId: true },
      });
      if (detectCycle(existing.map((e) => ({ source: e.sourceTaskId, target: e.targetTaskId })), source, target)) {
        throw new ConflictException('link would create a cycle');
      }

      try {
        const row = await tx.taskLink.create({
          data: { projectId, sourceTaskId: source, targetTaskId: target, type: dto.type },
        });
        return this.toResponse(row);
      } catch (err: any) {
        if (err.code === 'P2002') throw new ConflictException('link already exists');
        throw err;
      }
    });
  }

  async update(id: bigint, dto: UpdateTaskLinkDto): Promise<TaskLinkResponse> {
    const updated = await this.prisma.taskLink.update({ where: { id }, data: { type: dto.type } });
    return this.toResponse(updated);
  }

  async remove(id: bigint): Promise<void> {
    await this.prisma.taskLink.delete({ where: { id } });
  }

  private toResponse(r: any): TaskLinkResponse {
    return {
      id: r.id.toString(),
      projectId: r.projectId.toString(),
      sourceTaskId: r.sourceTaskId.toString(),
      targetTaskId: r.targetTaskId.toString(),
      type: r.type,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
```

- [ ] **Step 6: Controller**

```ts
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateTaskLinkDto, UpdateTaskLinkDto } from '@project-workgroup/shared';
import { AuthGuard } from '../auth/auth.guard';
import { ProjectMembershipGuard } from '../auth/project-membership.guard';
import { RequireProject } from '../auth/require-project.decorator';
import { TaskLinksService } from './task-links.service';

@ApiTags('task-links')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: '1' })
export class TaskLinksController {
  constructor(private readonly svc: TaskLinksService) {}

  @Get('projects/:projectId/task-links')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  list(@Param('projectId') id: string) { return this.svc.list(BigInt(id)); }

  @Post('projects/:projectId/task-links')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  create(@Param('projectId') id: string, @Body() dto: CreateTaskLinkDto) { return this.svc.create(BigInt(id), dto); }

  @Patch('task-links/:id') update(@Param('id') id: string, @Body() dto: UpdateTaskLinkDto) { return this.svc.update(BigInt(id), dto); }
  @Delete('task-links/:id') @HttpCode(204) remove(@Param('id') id: string) { return this.svc.remove(BigInt(id)); }
}
```

- [ ] **Step 7: Module + register in AppModule**

- [ ] **Step 8: E2E — create valid link, duplicate → 409, cycle → 409, delete**

- [ ] **Step 9: Tests pass + commit**

```bash
npm -w apps/api run test:e2e -- --testPathPattern task-links
npm run api:openapi:dump
git add .
git commit -m "feat(api): task links with cycle detection"
```

### Task 4.6: Workload module (minimal)

**Files:**
- Create: `packages/shared/src/dto/workload.dto.ts`
- Create: `apps/api/src/workload/workload.service.ts`
- Create: `apps/api/src/workload/workload.controller.ts`
- Create: `apps/api/src/workload/workload.module.ts`
- Create: `apps/api/test/workload.e2e-spec.ts`

- [ ] **Step 1: DTOs**

```ts
// packages/shared/src/dto/workload.dto.ts
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateWorkloadDto {
  @IsString() userId!: string;
  @IsString() taskId!: string;
  @IsString() projectId!: string;
  @IsDateString() date!: string;
  @IsNumber() allocatedHours!: number;
  @IsOptional() @IsNumber() actualHours?: number;
}

export class QueryWorkloadDto {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export interface WorkloadResponse {
  id: string;
  userId: string;
  taskId: string;
  projectId: string;
  date: string;
  allocatedHours: number;
  actualHours: number | null;
}
```

- [ ] **Step 2: Service (query + create)**

```ts
// apps/api/src/workload/workload.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkloadDto, QueryWorkloadDto, WorkloadResponse } from '@project-workgroup/shared';

@Injectable()
export class WorkloadService {
  constructor(private readonly prisma: PrismaService) {}

  async query(q: QueryWorkloadDto): Promise<WorkloadResponse[]> {
    const rows = await this.prisma.workload.findMany({
      where: {
        userId: q.userId ? BigInt(q.userId) : undefined,
        projectId: q.projectId ? BigInt(q.projectId) : undefined,
        date: {
          gte: q.from ? new Date(q.from) : undefined,
          lte: q.to ? new Date(q.to) : undefined,
        },
      },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async create(dto: CreateWorkloadDto): Promise<WorkloadResponse> {
    const row = await this.prisma.workload.create({
      data: {
        userId: BigInt(dto.userId),
        taskId: BigInt(dto.taskId),
        projectId: BigInt(dto.projectId),
        date: new Date(dto.date),
        allocatedHours: dto.allocatedHours as any,
        actualHours: (dto.actualHours ?? null) as any,
      },
    });
    return this.toResponse(row);
  }

  private toResponse(r: any): WorkloadResponse {
    return {
      id: r.id.toString(),
      userId: r.userId.toString(),
      taskId: r.taskId.toString(),
      projectId: r.projectId.toString(),
      date: r.date.toISOString().slice(0, 10),
      allocatedHours: Number(r.allocatedHours),
      actualHours: r.actualHours === null ? null : Number(r.actualHours),
    };
  }
}
```

- [ ] **Step 3: Controller + module + register**

(Similar to prior modules — skipped for brevity but use exactly the same patterns; import `@Controller({ path: 'workload', version: '1' })`.)

- [ ] **Step 4: E2E test — create + query by date range**

- [ ] **Step 5: Commit**

```bash
npm run api:openapi:dump
git add .
git commit -m "feat(api): minimal workload module"
```


## Phase 5 — API keys

### Task 5.1: Backend `ApiKeys` module

**Files:**
- Create: `packages/shared/src/dto/api-key.dto.ts`
- Create: `apps/api/src/api-keys/api-keys.service.ts`
- Create: `apps/api/src/api-keys/api-keys.controller.ts`
- Create: `apps/api/src/api-keys/api-keys.module.ts`
- Create: `apps/api/test/api-keys.e2e-spec.ts`

- [ ] **Step 1: DTOs**

`packages/shared/src/dto/api-key.dto.ts`:
```ts
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsString() @MinLength(1) @MaxLength(100)
  name!: string;

  @IsOptional() @IsDateString()
  expiresAt?: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyResponse extends ApiKeyResponse {
  plaintext: string;
}
```

- [ ] **Step 2: Service**

`apps/api/src/api-keys/api-keys.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyResponse, CreateApiKeyDto, CreateApiKeyResponse } from '@project-workgroup/shared';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: bigint): Promise<ApiKeyResponse[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async create(userId: bigint, dto: CreateApiKeyDto): Promise<CreateApiKeyResponse> {
    const raw = this.generatePlaintext();
    const keyHash = await argon2.hash(raw, { type: argon2.argon2id });
    const prefix = raw.slice(0, 8);
    const row = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        keyHash,
        prefix,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    return { ...this.toResponse(row), plaintext: raw };
  }

  async revoke(userId: bigint, id: bigint): Promise<void> {
    const row = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw new NotFoundException('api key not found');
    await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  private generatePlaintext(): string {
    return `pwg_${randomBytes(32).toString('base64url')}`;
  }

  private toResponse(r: any): ApiKeyResponse {
    return {
      id: r.id.toString(),
      name: r.name,
      prefix: r.prefix,
      lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 3: Controller**

`apps/api/src/api-keys/api-keys.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateApiKeyDto } from '@project-workgroup/shared';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ApiKeysService } from './api-keys.service';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'me/api-keys', version: '1' })
export class ApiKeysController {
  constructor(private readonly svc: ApiKeysService) {}

  @Get() list(@CurrentUser() user: AuthUser) { return this.svc.list(user.id); }

  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto) {
    return this.svc.create(user.id, dto);
  }

  @Delete(':id') @HttpCode(204)
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.revoke(user.id, BigInt(id));
  }
}
```

- [ ] **Step 4: Module + register in AppModule**

- [ ] **Step 5: E2E test — create, list, use key for auth, revoke**

`apps/api/test/api-keys.e2e-spec.ts`:
```ts
import * as request from 'supertest';
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';

describe('ApiKeys (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let userId: bigint;

  beforeAll(async () => {
    handle = await bootE2E({
      overrideGuard: {
        guard: AuthGuard,
        value: {
          canActivate: (ctx: any) => {
            ctx.switchToHttp().getRequest().user = { id: userId, firebaseUid: 'fb-x', role: 'member', via: 'firebase' };
            return true;
          },
        },
      },
    });
    prisma = handle.app.get(PrismaService);
    const u = await prisma.user.create({ data: { firebaseUid: 'fb-x', email: 'x@y.z', displayName: 'X', role: 'member' } });
    userId = u.id;
  }, 120_000);

  afterAll(() => handle.close());

  it('creates and lists api keys', async () => {
    const created = await request(handle.app.getHttpServer())
      .post('/v1/me/api-keys')
      .send({ name: 'primary' });
    expect(created.status).toBe(201);
    expect(created.body.plaintext).toMatch(/^pwg_/);
    expect(created.body.prefix).toHaveLength(8);

    const list = await request(handle.app.getHttpServer()).get('/v1/me/api-keys');
    expect(list.body.length).toBe(1);
    expect(list.body[0]).not.toHaveProperty('plaintext');

    const del = await request(handle.app.getHttpServer()).delete(`/v1/me/api-keys/${list.body[0].id}`);
    expect(del.status).toBe(204);

    const afterRevoke = await request(handle.app.getHttpServer()).get('/v1/me/api-keys');
    expect(afterRevoke.body.length).toBe(0);
  });
});
```

- [ ] **Step 6: Tests pass + commit**

```bash
npm -w apps/api run test:e2e -- --testPathPattern api-keys
npm run api:openapi:dump
git add .
git commit -m "feat(api): api keys module (list/create/revoke)"
```

### Task 5.2: Frontend `/account/api-keys` page

**Files:**
- Create: `apps/web/src/pages/AccountApiKeys.tsx`
- Create: `apps/web/src/services/apiKeyService.ts`
- Modify: `apps/web/src/App.tsx` (or the central router) to register the route

- [ ] **Step 1: Service**

`apps/web/src/services/apiKeyService.ts`:
```ts
import { apiClient } from '../lib/apiClient';
import type { ApiKeyResponse, CreateApiKeyResponse } from '@project-workgroup/shared';

export const apiKeyService = {
  list: () => apiClient.get<ApiKeyResponse[]>('/v1/me/api-keys'),
  create: (name: string, expiresAt?: string) =>
    apiClient.post<CreateApiKeyResponse>('/v1/me/api-keys', { name, expiresAt }),
  revoke: (id: string) => apiClient.delete(`/v1/me/api-keys/${id}`),
};
```

(Assumes `apiClient` from Task 6.1 exists — if not yet, reorder: do Task 6.1 before 5.2, or stub with `fetch` calls that match the final interface.)

- [ ] **Step 2: Page component**

`apps/web/src/pages/AccountApiKeys.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { apiKeyService } from '../services/apiKeyService';
import type { ApiKeyResponse } from '@project-workgroup/shared';

export default function AccountApiKeys() {
  const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
  const [name, setName] = useState('');
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => apiKeyService.list().then((data) => setKeys(data)).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, []);

  const onCreate = async () => {
    if (!name.trim()) return;
    const created = await apiKeyService.create(name.trim());
    setJustCreated(created.plaintext);
    setName('');
    await refresh();
  };

  const onRevoke = async (id: string) => {
    if (!confirm('Revoke this key?')) return;
    await apiKeyService.revoke(id);
    await refresh();
  };

  return (
    <section className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">API keys</h1>

      {justCreated && (
        <div className="border-2 border-yellow-400 p-4 rounded">
          <p className="font-semibold mb-2">Copy this key now. You will not see it again.</p>
          <code className="block bg-gray-100 p-2 rounded break-all">{justCreated}</code>
          <button className="mt-2 underline" onClick={() => setJustCreated(null)}>Dismiss</button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="key name"
          className="border px-2 py-1 rounded flex-1"
        />
        <button onClick={onCreate} className="px-3 py-1 bg-blue-600 text-white rounded">Create</button>
      </div>

      {loading ? <p>Loading…</p> : (
        <ul className="divide-y">
          {keys.length === 0 && <li className="py-4 text-gray-500">No keys.</li>}
          {keys.map((k) => (
            <li key={k.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{k.name}</p>
                <p className="text-sm text-gray-500">{k.prefix}… · last used {k.lastUsedAt ?? 'never'}</p>
              </div>
              <button onClick={() => onRevoke(k.id)} className="text-red-600">Revoke</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Register route**

Open `apps/web/src/App.tsx`. After existing protected routes, add:
```tsx
import AccountApiKeys from './pages/AccountApiKeys';
// ...
<Route path="/account/api-keys" element={<ProtectedRoute><AccountApiKeys /></ProtectedRoute>} />
```

- [ ] **Step 4: Smoke**

Run `npm run dev`. Navigate to `http://localhost:5173/account/api-keys`. With dev seed user signed in, create a key, verify plaintext appears once, revoke, list refreshes.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): /account/api-keys page with copy-once modal"
```


## Phase 6 — Frontend cutover

Phase 6 re-wires the React app off Firestore and onto the new API. The Firebase Auth SDK stays (Google-only). Do Task 6.1 before 5.2 if API keys UI hasn't shipped yet.

### Task 6.1: Build `apiClient`

**Files:**
- Create: `apps/web/src/lib/apiClient.ts`
- Create: `apps/web/src/lib/__tests__/apiClient.test.ts`
- Modify: `apps/web/.env.example`
- Modify: `apps/web/.env`

- [ ] **Step 1: Add env var**

Append to `apps/web/.env.example`:
```
VITE_API_URL=http://localhost:3000
```
Copy to `apps/web/.env` (or update if present).

- [ ] **Step 2: Failing test**

`apps/web/src/lib/__tests__/apiClient.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, createApiClient } from '../apiClient';

describe('apiClient', () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn();
  });

  it('injects Authorization header from tokenProvider', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    (globalThis as any).fetch = fetchMock;

    const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 'abc' });
    const res = await client.get<{ ok: boolean }>('/v1/users/me');

    expect(res).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get('authorization')).toBe('Bearer abc');
  });

  it('parses error envelope into ApiError', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'not_found', message: 'nope' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
    await expect(client.get('/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
      message: 'nope',
    });
  });

  it('returns undefined for 204 responses', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
    await expect(client.delete('/x')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Implement**

`apps/web/src/lib/apiClient.ts`:
```ts
export class ApiError extends Error {
  readonly name = 'ApiError';
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  tokenProvider: () => Promise<string | null>;
}

export interface ApiClient {
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body: unknown, init?: RequestInit): Promise<T>;
  patch<T>(path: string, body: unknown, init?: RequestInit): Promise<T>;
  delete(path: string, init?: RequestInit): Promise<void>;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const doFetch = async (method: string, path: string, body?: unknown, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const token = await opts.tokenProvider();
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (body !== undefined) headers.set('content-type', 'application/json');
    const res = await fetch(`${opts.baseUrl}${path}`, {
      ...init,
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let code = 'unknown';
      let msg = res.statusText;
      let details: unknown;
      const ct = res.headers.get('content-type');
      if (ct?.includes('application/json')) {
        const payload = await res.json().catch(() => ({}));
        code = payload?.error?.code ?? code;
        msg = payload?.error?.message ?? msg;
        details = payload?.error?.details;
      }
      throw new ApiError(res.status, code, msg, details);
    }
    return res;
  };

  const asJson = async <T>(res: Response): Promise<T> => {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  };

  return {
    get: async <T>(path, init) => asJson<T>(await doFetch('GET', path, undefined, init)),
    post: async <T>(path, body, init) => asJson<T>(await doFetch('POST', path, body, init)),
    patch: async <T>(path, body, init) => asJson<T>(await doFetch('PATCH', path, body, init)),
    delete: async (path, init) => { await doFetch('DELETE', path, undefined, init); },
  };
}

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function firebaseIdTokenProvider(): Promise<string | null> {
  const { getAuth } = await import('firebase/auth');
  const user = getAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export const apiClient = createApiClient({ baseUrl, tokenProvider: firebaseIdTokenProvider });
```

- [ ] **Step 4: Tests pass**

`npm -w apps/web run test:run -- apiClient`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib apps/web/.env.example
git commit -m "feat(web): apiClient with Firebase token interceptor"
```

### Task 6.2: Rename `types/firestore.ts` → `types/domain.ts`

**Files:**
- Rename: `apps/web/src/types/firestore.ts` → `apps/web/src/types/domain.ts`
- Modify: every import site

- [ ] **Step 1: Git move**

```bash
git mv apps/web/src/types/firestore.ts apps/web/src/types/domain.ts
```

- [ ] **Step 2: Find all imports**

Run:
```bash
grep -rn "from '.*types/firestore'" apps/web/src
grep -rn 'from ".*types/firestore"' apps/web/src
```
Record each file path shown.

- [ ] **Step 3: Replace imports**

For each file reported, edit `types/firestore` → `types/domain`.

- [ ] **Step 4: Remove `Timestamp` usage**

Inside `apps/web/src/types/domain.ts`, replace any `Timestamp` from `firebase/firestore` with `string` (ISO) and remove the `firebase/firestore` import.

Example: if a field was `createdAt: Timestamp`, make it `createdAt: string`.

- [ ] **Step 5: Typecheck**

```bash
npm -w apps/web run build
```
Fix any type errors surfaced (typically call sites that expected `Timestamp.toDate()` — replace with `new Date(value)`).

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "refactor(web): rename types/firestore → types/domain and remove Timestamp"
```

### Task 6.3: Rewrite `projectService.ts`

**Files:**
- Modify: `apps/web/src/services/projectService.ts`
- Modify: `apps/web/src/services/__tests__/projectService.test.ts`

- [ ] **Step 1: Replace implementation**

Open `apps/web/src/services/projectService.ts` and replace the Firestore implementation entirely with:
```ts
import { apiClient } from '../lib/apiClient';
import type { Project, CreateProjectData, UpdateProjectData } from '../types/domain';
import type { ProjectResponse, CreateProjectDto, UpdateProjectDto, PagedResponse } from '@project-workgroup/shared';

const toDomain = (r: ProjectResponse): Project => ({
  id: r.id,
  name: r.name,
  description: r.description ?? '',
  startDate: r.startDate,
  endDate: r.endDate,
  status: r.status,
  ownerId: r.ownerId,
  members: [],
  color: r.color,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const projectService = {
  create: async (data: CreateProjectData): Promise<Project> => {
    const dto: CreateProjectDto = {
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      color: data.color,
    };
    const res = await apiClient.post<ProjectResponse>('/v1/projects', dto);
    return toDomain(res);
  },
  get: async (id: string): Promise<Project> => toDomain(await apiClient.get<ProjectResponse>(`/v1/projects/${id}`)),
  list: async (): Promise<Project[]> => {
    const res = await apiClient.get<PagedResponse<ProjectResponse>>('/v1/projects');
    return res.items.map(toDomain);
  },
  update: async (id: string, data: UpdateProjectData): Promise<Project> => {
    const dto: UpdateProjectDto = { ...data };
    const res = await apiClient.patch<ProjectResponse>(`/v1/projects/${id}`, dto);
    return toDomain(res);
  },
  delete: async (id: string): Promise<void> => apiClient.delete(`/v1/projects/${id}`),
  addMember: async (projectId: string, userId: string): Promise<void> => {
    await apiClient.post(`/v1/projects/${projectId}/members`, { userId, projectRole: 'contributor' });
  },
  removeMember: async (projectId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/v1/projects/${projectId}/members/${userId}`);
  },
};
```

- [ ] **Step 2: Update existing tests**

Open `apps/web/src/services/__tests__/projectService.test.ts` (or create if absent). Replace any Firestore mock with `vi.mock('../../lib/apiClient')`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { projectService } from '../projectService';
import { apiClient } from '../../lib/apiClient';

vi.mock('../../lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('projectService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list maps API response to domain', async () => {
    (apiClient.get as any).mockResolvedValue({ items: [{ id: '1', name: 'P', description: null, startDate: '2026-01-01', endDate: '2026-02-01', status: 'planning', ownerId: '2', color: '#000', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }], nextCursor: null });
    const projects = await projectService.list();
    expect(projects[0].id).toBe('1');
    expect(projects[0].description).toBe('');
    expect(apiClient.get).toHaveBeenCalledWith('/v1/projects');
  });
});
```

- [ ] **Step 3: Run tests**

`npm -w apps/web run test:run -- projectService`

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "refactor(web): rewrite projectService against apiClient"
```

### Task 6.4: Rewrite `taskService.ts`

**Files:**
- Modify: `apps/web/src/services/taskService.ts`
- Modify: `apps/web/src/services/__tests__/taskService.test.ts`

- [ ] **Step 1: Replace implementation**

Replace the entire file with wrappers over `apiClient`. Keep the public method names/signatures used by hooks (scan `apps/web/src/hooks/usetasks.ts` before writing to preserve names).

```ts
import { apiClient } from '../lib/apiClient';
import type { Task, CreateTaskData, UpdateTaskData } from '../types/domain';
import type { CreateTaskDto, UpdateTaskDto, TaskResponse, UpdateProgressDto, UpdateOrderDto } from '@project-workgroup/shared';

const toDomain = (r: TaskResponse): Task => ({
  id: r.id,
  projectId: r.projectId,
  name: r.name,
  description: r.description ?? undefined,
  startDate: r.startDate,
  endDate: r.endDate,
  duration: r.duration,
  progress: r.progress,
  assigneeId: r.assigneeId ?? undefined,
  parentId: r.parentId ?? undefined,
  dependencies: [],
  tags: r.tags,
  priority: r.priority,
  color: r.color,
  estimatedHours: r.estimatedHours,
  actualHours: r.actualHours ?? undefined,
  status: r.status,
  type: r.type,
  order: r.order,
  open: r.open,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const TaskService = {
  createTask: async (data: CreateTaskData): Promise<Task> => {
    const dto: CreateTaskDto = {
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      duration: data.duration,
      progress: data.progress,
      assigneeId: data.assigneeId,
      parentId: data.parentId,
      priority: data.priority,
      status: data.status,
      type: data.type,
      color: data.color,
      open: data.open,
      tags: data.tags,
      estimatedHours: data.estimatedHours,
    };
    return toDomain(await apiClient.post<TaskResponse>(`/v1/projects/${data.projectId}/tasks`, dto));
  },

  getTask: async (id: string): Promise<Task | null> => {
    try {
      return toDomain(await apiClient.get<TaskResponse>(`/v1/tasks/${id}`));
    } catch (e: any) {
      if (e?.status === 404) return null;
      throw e;
    }
  },

  getProjectTasks: async (projectId: string): Promise<Task[]> => {
    const rows = await apiClient.get<TaskResponse[]>(`/v1/projects/${projectId}/tasks`);
    return rows.map(toDomain);
  },

  updateTask: async (id: string, data: UpdateTaskData): Promise<Task> => {
    const dto: UpdateTaskDto = { ...data };
    return toDomain(await apiClient.patch<TaskResponse>(`/v1/tasks/${id}`, dto));
  },

  deleteTask: async (id: string): Promise<void> => apiClient.delete(`/v1/tasks/${id}`),

  updateTaskProgress: async (id: string, progress: number): Promise<Task> => {
    const dto: UpdateProgressDto = { progress };
    return toDomain(await apiClient.patch<TaskResponse>(`/v1/tasks/${id}/progress`, dto));
  },

  updateTaskOrder: async (id: string, opts: { beforeTaskId?: string; afterTaskId?: string; parentId?: string | null }): Promise<Task> => {
    const dto: UpdateOrderDto = opts;
    return toDomain(await apiClient.patch<TaskResponse>(`/v1/tasks/${id}/order`, dto));
  },

  getUserTasks: async (_userId: string): Promise<Task[]> => {
    // Backend doesn't expose this yet; return []. Callers can switch to a project-scoped query.
    return [];
  },
};
```

- [ ] **Step 2: Update tests**

Replace Firestore mocks with `vi.mock('../../lib/apiClient')` following the Task 6.3 pattern. Verify basic CRUD method calls the correct endpoints.

- [ ] **Step 3: Run tests**

`npm -w apps/web run test:run -- taskService`

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "refactor(web): rewrite taskService against apiClient"
```

### Task 6.5: Rewrite `taskLinkService.ts`

**Files:**
- Modify: `apps/web/src/services/taskLinkService.ts`
- Modify: `apps/web/src/services/__tests__/taskLinkService.test.ts`

- [ ] **Step 1: Replace implementation**

```ts
import { apiClient } from '../lib/apiClient';
import type { TaskLink, CreateTaskLinkData, UpdateTaskLinkData } from '../types/domain';
import type { CreateTaskLinkDto, UpdateTaskLinkDto, TaskLinkResponse } from '@project-workgroup/shared';

const toDomain = (r: TaskLinkResponse): TaskLink => ({
  id: r.id,
  projectId: r.projectId,
  sourceTaskId: r.sourceTaskId,
  targetTaskId: r.targetTaskId,
  type: r.type,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const TaskLinkService = {
  createLink: async (projectId: string, data: CreateTaskLinkData): Promise<TaskLink> => {
    const dto: CreateTaskLinkDto = {
      sourceTaskId: data.sourceTaskId,
      targetTaskId: data.targetTaskId,
      type: data.type,
    };
    return toDomain(await apiClient.post<TaskLinkResponse>(`/v1/projects/${projectId}/task-links`, dto));
  },
  getProjectLinks: async (projectId: string): Promise<TaskLink[]> => {
    const rows = await apiClient.get<TaskLinkResponse[]>(`/v1/projects/${projectId}/task-links`);
    return rows.map(toDomain);
  },
  updateLink: async (id: string, data: UpdateTaskLinkData): Promise<TaskLink> => {
    const dto: UpdateTaskLinkDto = { type: data.type };
    return toDomain(await apiClient.patch<TaskLinkResponse>(`/v1/task-links/${id}`, dto));
  },
  deleteLink: async (id: string): Promise<void> => apiClient.delete(`/v1/task-links/${id}`),
  // Cycle detection now happens server-side; return false here to keep the call-site optimistic.
  detectCircularDependency: async (_projectId: string, _source: string, _target: string): Promise<boolean> => false,
};
```

- [ ] **Step 2: Tests + commit**

```bash
npm -w apps/web run test:run -- taskLinkService
git add apps/web
git commit -m "refactor(web): rewrite taskLinkService against apiClient"
```

### Task 6.6: Rewrite `memberService.ts` and `userService.ts`

**Files:**
- Modify: `apps/web/src/services/memberService.ts`
- Modify: `apps/web/src/services/userService.ts`

- [ ] **Step 1: `userService.ts`**

```ts
import { apiClient } from '../lib/apiClient';
import type { User } from '../types/domain';
import type { UserResponse, PagedResponse } from '@project-workgroup/shared';

const toDomain = (r: UserResponse): User => ({
  id: r.id,
  email: r.email,
  displayName: r.displayName,
  role: r.role,
  avatar: r.avatarUrl ?? undefined,
  createdAt: '',
  updatedAt: '',
});

export const userService = {
  getCurrent: async (): Promise<User> => toDomain(await apiClient.get<UserResponse>('/v1/users/me')),
  search: async (query: string): Promise<User[]> => {
    const res = await apiClient.get<PagedResponse<UserResponse>>(`/v1/users?search=${encodeURIComponent(query)}`);
    return res.items.map(toDomain);
  },
  syncAfterLogin: async (): Promise<User> => toDomain(await apiClient.post<UserResponse>('/v1/auth/sync', {})),
};
```

- [ ] **Step 2: `memberService.ts`**

```ts
import { apiClient } from '../lib/apiClient';
import type { User } from '../types/domain';
import type { ProjectMemberResponse } from '@project-workgroup/shared';

export const memberService = {
  getProjectMembers: async (projectId: string): Promise<User[]> => {
    const rows = await apiClient.get<ProjectMemberResponse[]>(`/v1/projects/${projectId}/members`);
    return rows.map((r) => ({
      id: r.user.id,
      email: r.user.email,
      displayName: r.user.displayName,
      role: 'member',
      avatar: r.user.avatarUrl ?? undefined,
      createdAt: '',
      updatedAt: '',
    }));
  },
  addMember: async (projectId: string, userId: string): Promise<void> => {
    await apiClient.post(`/v1/projects/${projectId}/members`, { userId, projectRole: 'contributor' });
  },
  removeMember: async (projectId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/v1/projects/${projectId}/members/${userId}`);
  },
};
```

- [ ] **Step 3: Tests + commit**

```bash
npm -w apps/web run test:run -- 'memberService|userService'
git add apps/web
git commit -m "refactor(web): rewrite memberService + userService against apiClient"
```

### Task 6.7: Simplify `ganttDataProvider.ts`

**Files:**
- Modify: `apps/web/src/services/ganttDataProvider.ts`

- [ ] **Step 1: Delete ID mapping fields and helpers**

Remove these properties from the class (around lines 14–18):
- `idMapping`
- `tempIdMapping`
- `linkIdMapping`

Remove these methods:
- `getFirestoreIdFromGanttId`
- `getFullTaskDataByGanttId`
- `getLinkFirestoreIdFromGanttId`
- `getFullLinkDataByGanttId`
- `getLinkGanttIdFromFirestoreId`
- Any code computing `task.id.split('').reduce(...)`

- [ ] **Step 2: Pass bigint-string IDs straight to Gantt**

Where the code previously emitted synthetic numeric IDs, use the task's `id` directly as a number: `Number(task.id)`. (API returns BigInt as numeric string; wx-react-gantt accepts `number | string` for IDs.)

Replace any `idMapping.set(numericId, firestoreId)` with no-op and any `idMapping.get(ganttId)` with `String(ganttId)`.

- [ ] **Step 3: Keep `tempIdMapping` only for optimistic creates**

For a freshly-created task where the Gantt emits a temporary ID before the API returns, keep a `tempIdMapping: Map<string, string>` that maps the temp ID to the real server ID. This is legitimate — the Gantt expects the temp ID at creation, and we swap it out when the POST resolves.

- [ ] **Step 4: Typecheck and run frontend tests**

```bash
npm -w apps/web run build
npm -w apps/web run test:run
```
Fix any compile errors flagged.

- [ ] **Step 5: Manual smoke**

`npm run dev`. Create a project, add tasks including subtasks, create links, reorder tasks, reload the page — verify no "ID not found" errors in the browser console and that the Gantt renders consistently across reloads.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "refactor(web): drop string↔number id mapping in ganttDataProvider"
```

### Task 6.8: Clean `AuthContext.tsx`

**Files:**
- Modify: `apps/web/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Keep only Google provider**

Open `AuthContext.tsx`. Remove:
- `signInWithEmailAndPassword` method + its export
- `createUserWithEmailAndPassword` method + its export
- `sendPasswordResetEmail` method + its export

Add a single `signInWithGoogle` method:
```ts
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
// inside provider:
const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
};
```

- [ ] **Step 2: Call `userService.syncAfterLogin` on auth state change**

Inside the existing `onAuthStateChanged` handler, after `setUser(firebaseUser)`, call:
```ts
if (firebaseUser) {
  try {
    const profile = await userService.syncAfterLogin();
    setUser((prev) => ({ ...prev!, role: profile.role, displayName: profile.displayName }));
  } catch (err) {
    console.error('auth/sync failed', err);
  }
}
```

- [ ] **Step 3: Remove Firestore user-document bootstrap**

Delete the `createUserDocument` helper (or the equivalent that writes to `users` collection via Firestore) — the backend owns this now.

- [ ] **Step 4: Update login pages**

Find `apps/web/src/pages/Login.tsx` (or similar) and replace the email/password form with a single "Sign in with Google" button that calls `signInWithGoogle`. Delete any signup page.

```bash
grep -rn 'signInWithEmailAndPassword\|createUserWithEmailAndPassword\|sendPasswordResetEmail' apps/web/src
```
Resolve each reported site.

- [ ] **Step 5: Typecheck**

```bash
npm -w apps/web run build
```
Fix errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "refactor(web): AuthContext uses Google-only + backend sync"
```

### Task 6.9: End-to-end smoke

**Files:** _(none)_

- [ ] **Step 1: Start everything**

```bash
npm run db:up
npm run migrate
SEED_ADMIN_UID=<your-firebase-uid> SEED_ADMIN_EMAIL=<your-gmail> npm run seed
npm run dev
```

(Use your real Firebase Google UID so the seeded admin row matches your login.)

- [ ] **Step 2: Verify the flows**

In a browser:
1. Visit `http://localhost:5173/login`, sign in with Google.
2. `POST /v1/auth/sync` appears in the network tab, returns 200 with your user.
3. Create a project; create tasks (including sub-tasks); create task links; reorder tasks; delete a task.
4. Refresh the page; state persists exactly.
5. Visit `/account/api-keys`; create a key; copy plaintext; `curl -H 'Authorization: Bearer <key>' http://localhost:3000/v1/users/me` returns 200 with your user.

- [ ] **Step 3: Commit checkpoint**

```bash
git commit --allow-empty -m "chore: phase 6 cutover verified end-to-end"
```


## Phase 7 — Cleanup

### Task 7.1: Remove Firestore artifacts

**Files:**
- Delete: `firestore/firestore.rules`
- Delete: `firestore/firestore.indexes.json`
- Delete: `scripts/setup-firestore.js`
- Delete: `scripts/firestore-cli.js`
- Modify: `firebase.json`

- [ ] **Step 1: Remove Firestore files**

```bash
git rm -r firestore
git rm scripts/setup-firestore.js scripts/firestore-cli.js
```

- [ ] **Step 2: Strip Firestore config from `firebase.json`**

Open `firebase.json`. Delete any `"firestore": { ... }` block. If the file ends up with only an empty object or only hosting config that's unused, delete it entirely:
```bash
git rm firebase.json
```
Otherwise save the trimmed file.

- [ ] **Step 3: Remove scripts directory if now empty**

```bash
rmdir scripts 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove firestore rules, indexes, and setup scripts"
```

### Task 7.2: Strip Firestore deps and scripts

**Files:**
- Modify: `apps/web/package.json`
- Modify: `package.json` (root)

- [ ] **Step 1: Remove `firebase-admin` from `apps/web/package.json`**

Open `apps/web/package.json`. Under `dependencies`, delete the `"firebase-admin"` line.
Keep `"firebase"` — the Auth SDK still ships in the browser.

- [ ] **Step 2: Remove firestore-related scripts from root `package.json`**

Delete these scripts if present in the root `package.json` (they are leftovers from Phase 1 reorg):
- `setup:firestore`
- `setup:firestore:sample`
- `setup:cli`
- `firebase:rules`
- `firebase:indexes`
- `firebase:deploy`

- [ ] **Step 3: Reinstall**

```bash
npm install
```

- [ ] **Step 4: Verify no Firestore imports remain**

```bash
grep -rn "firebase/firestore" apps/web/src
grep -rn "firebase-admin" apps/web
```
Expected: both return empty.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: drop firebase-admin dep and firestore npm scripts"
```

### Task 7.3: Clean `apps/web/.env.example`

**Files:**
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Keep only Auth-related vars + API URL**

Replace the file contents with:
```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id

VITE_API_URL=http://localhost:3000
```

(Auth uses `apiKey`, `authDomain`, `projectId`, `appId` — the `storageBucket` and `messagingSenderId` are only needed for Firestore/Storage/FCM and can go.)

- [ ] **Step 2: Commit**

```bash
git add apps/web/.env.example
git commit -m "chore(web): trim .env.example to auth-only + api url"
```

### Task 7.4: Update docs

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `README.md`**

Replace the development/setup section so it reads:
```md
## Development

1. Copy `.env.example` files:
   - `apps/web/.env.example` → `apps/web/.env` (fill Firebase Auth vars + VITE_API_URL)
   - `apps/api/.env.example` → `apps/api/.env` (DATABASE_URL, FIREBASE_SERVICE_ACCOUNT_JSON)

2. Start Postgres: `npm run db:up`
3. Apply migrations: `npm run migrate`
4. Seed an admin: `SEED_ADMIN_UID=<firebase-uid> SEED_ADMIN_EMAIL=<email> npm run seed`
5. Run everything: `npm run dev`

- Web: http://localhost:5173
- API: http://localhost:3000/v1/docs
```

- [ ] **Step 2: Update `CONTRIBUTING.md`**

Remove any references to Firestore setup. Add a section on the new layout:
```md
## Repository layout

- `apps/web` — React frontend
- `apps/api` — NestJS backend
- `packages/shared` — DTOs shared between frontend and backend
```

- [ ] **Step 3: Update `CLAUDE.md`**

Rewrite the `## Architecture` section to reflect the new backend:
```md
**Stack:** React 18 + TypeScript + Vite (apps/web); NestJS 10 + Prisma 5 + Postgres 16 (apps/api); Firebase Auth (Google-only).

### Monorepo layout

- `apps/web` consumes `apps/api` via `src/lib/apiClient.ts` (fetch wrapper injecting Firebase ID tokens).
- `apps/api` exposes REST under `/v1/*`, documented at `/v1/docs`.
- `packages/shared` holds DTOs + response types.

### Auth flow

Frontend obtains Firebase ID token via Google sign-in, sends `Authorization: Bearer <token>` on every request. Backend `AuthGuard` verifies as Firebase first, then tries API-key (argon2-hashed) as a fallback.
```

Also remove the Firestore collections table and the "dual-layer design" paragraph (no longer applies).

- [ ] **Step 4: Commit**

```bash
git add README.md CONTRIBUTING.md CLAUDE.md
git commit -m "docs: update README, CONTRIBUTING, CLAUDE for new architecture"
```


## Phase 8 — Production deploy

Phase 8 is one-time infra work. Each task has manual steps that cross external consoles; capture the resulting URLs/secrets in a password manager, never in the repo.

### Task 8.1: Provision Supabase Postgres

**Files:** _(none — external setup)_

- [ ] **Step 1: Create Supabase project**

In the Supabase dashboard: New project → name `project-workgroup-prod` → region closest to users → strong DB password.

- [ ] **Step 2: Grab the pooled connection string**

From Project Settings → Database → Connection string → "Transaction" pooler (port 6543). Copy the URI. It should look like:
```
postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

- [ ] **Step 3: Reserve for Railway env**

Store the URL safely; it becomes `DATABASE_URL` in Task 8.2.

### Task 8.2: Containerize `apps/api`

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/api/.dockerignore`

- [ ] **Step 1: Dockerfile**

`apps/api/Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspaces --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN npm -w apps/api exec prisma generate
RUN npm -w apps/api run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./package.json
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

- [ ] **Step 2: Dockerignore**

`apps/api/.dockerignore`:
```
node_modules
dist
.env
.env.*
test
coverage
```

- [ ] **Step 3: Build locally to verify**

```bash
docker build -t pwg-api:local -f apps/api/Dockerfile .
```
Expected: successful build.

- [ ] **Step 4: Commit**

```bash
git add apps/api/Dockerfile apps/api/.dockerignore
git commit -m "feat(api): production Dockerfile + dockerignore"
```

### Task 8.3: Deploy to Railway

**Files:** _(none — Railway config)_

- [ ] **Step 1: Create Railway project**

`railway login` then `railway init` from repo root. Link to a new project `project-workgroup-api`.

- [ ] **Step 2: Configure env vars**

In Railway dashboard → Service → Variables, set:
- `DATABASE_URL` = the Supabase pooled URI from Task 8.1
- `FIREBASE_SERVICE_ACCOUNT_JSON` = paste the contents of a service account JSON (generated in Firebase Console → Service Accounts → Generate new private key). Paste the raw JSON as the value; our `FirebaseService` parses it.
- `ALLOWED_ORIGINS` = production frontend URL (comma-separated if multiple)
- `NODE_ENV` = `production`
- `PORT` = `3000`

- [ ] **Step 3: Set root Dockerfile path**

In Railway service settings, point the build to `apps/api/Dockerfile` with the build context at repo root.

- [ ] **Step 4: Deploy**

Push the current branch; Railway builds the container. Tail the deploy logs: expect `prisma migrate deploy` to apply migrations, then `Nest application successfully started`.

- [ ] **Step 5: Smoke-test production**

```bash
curl -sf https://<your-railway-domain>/v1/docs
```
Expected: Swagger UI HTML. Also:
```bash
curl -sf https://<your-railway-domain>/v1/users/me
```
Expected: HTTP 401 (no token) — confirms the API is up and the guard runs.

- [ ] **Step 6: Capture the public URL**

You'll need it for Task 8.4.

### Task 8.4: Repoint the frontend and disable email/password

**Files:**
- Modify: frontend host environment variables (hosted side, not in repo)

- [ ] **Step 1: Update `VITE_API_URL` in hosting**

Set `VITE_API_URL` to the Railway URL in your frontend host's environment settings. Trigger a redeploy.

- [ ] **Step 2: Disable email/password provider**

Firebase Console → Authentication → Sign-in method → Email/Password → Disable. Keep Google enabled.

- [ ] **Step 3: Seed a production admin**

Run a one-shot Railway job (or `railway run` locally with prod env) to execute:
```bash
SEED_ADMIN_UID=<your-google-firebase-uid> SEED_ADMIN_EMAIL=<your-gmail> npm run seed
```

- [ ] **Step 4: Final end-to-end test**

Visit the production frontend URL:
1. Log in with Google.
2. Create a project, tasks, links.
3. `curl -H "Authorization: Bearer <api-key>" https://<railway>/v1/users/me` returns 200 with your user.
4. Revoke the key in `/account/api-keys`, confirm subsequent curl returns 401.

- [ ] **Step 5: Close the feature branch**

Open a PR from `feature/monorepo-api-migration` to `main`. Summarize phases in the PR description. After review and merge, delete the remote branch.

---

## Verification checklist (after Phase 8)

- [ ] `npm run db:up && npm run migrate && npm run seed && npm run dev` boots cleanly on a fresh clone.
- [ ] `http://localhost:3000/v1/docs` shows Swagger with all documented endpoints.
- [ ] Login with Google triggers `POST /v1/auth/sync` (200).
- [ ] Creating a project, tasks with hierarchy, and links from the frontend round-trips through the API and persists on reload.
- [ ] Attempting to create a cyclic link returns 409.
- [ ] `curl -H "Authorization: Bearer <api-key>" https://<prod>/v1/users/me` succeeds.
- [ ] `grep -r "firebase/firestore" apps/web/src` returns nothing.
- [ ] `npm run api:openapi:check` passes in CI.
- [ ] All Jest/Vitest suites pass in both workspaces.

---

## Self-review notes

- **Spec coverage:** Every section of the spec has a task. Modelo de datos → Tasks 2.3–2.9. Autenticación → Tasks 3.2–3.7. Contrato API → Tasks 3.7 + 4.1–4.6 + 5.1. Frontend → Tasks 6.1–6.8. Dev workflow → Tasks 2.1 + 1.3. Testing → Tasks 4.x test harnesses. Fases 1–8 → Phase 1–8.
- **Type consistency:** Wire enums expose `on-hold`, `not-started`, `in-progress` while Prisma enums use underscore variants; the mapper files (`status.mapper.ts`, `wire.ts`) enforce the translation. `AuthUser` shape matches what `CurrentUser` decorator returns throughout.
- **Ordering caveat:** Task 5.2 depends on Task 6.1 (`apiClient`). If an engineer picks up phases strictly in order, they can either (a) stub `apiClient` inside 5.2 or (b) pull 6.1 forward. The plan calls this out at the top of Phase 6.
- **Known partial:** `TaskService.getUserTasks` returns `[]` (Task 6.4) because the backend doesn't expose a global user-tasks endpoint yet. If the frontend depends on it, add a `GET /v1/users/me/tasks` endpoint to Task 4.4 before touching that service method.


