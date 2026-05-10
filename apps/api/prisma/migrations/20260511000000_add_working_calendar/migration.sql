-- Working calendar: jornada laboral + festivos + timezone.
-- Scope GLOBAL (uno solo) con override por proyecto.

-- CreateEnum
CREATE TYPE "CalendarScope" AS ENUM ('global', 'project');

-- CreateTable
CREATE TABLE "working_calendars" (
    "id" BIGSERIAL NOT NULL,
    "scope" "CalendarScope" NOT NULL,
    "project_id" BIGINT,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "working_calendars_pkey" PRIMARY KEY ("id")
);

-- Garantiza un único calendario por proyecto.
CREATE UNIQUE INDEX "working_calendars_project_id_key" ON "working_calendars"("project_id");

-- Garantiza exactamente un calendario GLOBAL en toda la DB.
CREATE UNIQUE INDEX "working_calendars_global_unique" ON "working_calendars"("scope") WHERE "scope" = 'global';

-- scope='global' ↔ project_id IS NULL.  scope='project' ↔ project_id IS NOT NULL.
ALTER TABLE "working_calendars"
    ADD CONSTRAINT "working_calendars_scope_project_check"
    CHECK (("scope" = 'global' AND "project_id" IS NULL) OR ("scope" = 'project' AND "project_id" IS NOT NULL));

ALTER TABLE "working_calendars"
    ADD CONSTRAINT "working_calendars_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "working_day_patterns" (
    "calendar_id" BIGINT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "day_start" TIME(6),
    "break_start" TIME(6),
    "break_end" TIME(6),
    "day_end" TIME(6),

    CONSTRAINT "working_day_patterns_pkey" PRIMARY KEY ("calendar_id","weekday")
);

-- weekday válido: 0 (Dom) - 6 (Sáb).
ALTER TABLE "working_day_patterns"
    ADD CONSTRAINT "working_day_patterns_weekday_range"
    CHECK ("weekday" >= 0 AND "weekday" <= 6);

-- Si enabled, day_start y day_end son obligatorios y ordenados.
ALTER TABLE "working_day_patterns"
    ADD CONSTRAINT "working_day_patterns_enabled_requires_bounds"
    CHECK (
      NOT "enabled"
      OR (
        "day_start" IS NOT NULL
        AND "day_end" IS NOT NULL
        AND "day_start" < "day_end"
      )
    );

-- La pausa (si existe) debe estar dentro del rango del día.
ALTER TABLE "working_day_patterns"
    ADD CONSTRAINT "working_day_patterns_break_within_day"
    CHECK (
      ("break_start" IS NULL AND "break_end" IS NULL)
      OR (
        "break_start" IS NOT NULL
        AND "break_end" IS NOT NULL
        AND "day_start" IS NOT NULL
        AND "day_end" IS NOT NULL
        AND "day_start" <= "break_start"
        AND "break_start" < "break_end"
        AND "break_end" <= "day_end"
      )
    );

ALTER TABLE "working_day_patterns"
    ADD CONSTRAINT "working_day_patterns_calendar_id_fkey"
    FOREIGN KEY ("calendar_id") REFERENCES "working_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "holidays" (
    "calendar_id" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "recurring_yearly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("calendar_id","date")
);

ALTER TABLE "holidays"
    ADD CONSTRAINT "holidays_calendar_id_fkey"
    FOREIGN KEY ("calendar_id") REFERENCES "working_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Workload: blindar contra duplicados (taskId, userId, date).
-- Permite que el SchedulingService re-genere filas sin race con un upsert seguro.
CREATE UNIQUE INDEX IF NOT EXISTS "workload_task_user_date_unique" ON "workload"("task_id", "user_id", "date");
