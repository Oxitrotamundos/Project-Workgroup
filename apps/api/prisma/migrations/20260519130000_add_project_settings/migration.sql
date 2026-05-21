-- Tabla de ajustes por proyecto. Relación 1-1 con projects.
-- timeGranularity puede ser 'hours' (default) o 'days'.
CREATE TABLE "project_settings" (
    "project_id" BIGINT NOT NULL,
    "time_granularity" TEXT NOT NULL DEFAULT 'hours',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_settings_pkey" PRIMARY KEY ("project_id")
);

ALTER TABLE "project_settings"
    ADD CONSTRAINT "project_settings_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
