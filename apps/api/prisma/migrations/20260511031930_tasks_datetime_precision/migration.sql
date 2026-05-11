-- Migrar tasks.start_date y tasks.end_date de DATE a TIMESTAMPTZ(0).
-- Las filas existentes conservan su fecha original con hora 00:00:00 UTC.
ALTER TABLE "tasks"
  ALTER COLUMN "start_date" TYPE TIMESTAMPTZ(0)
    USING (("start_date"::text || ' 00:00:00+00')::TIMESTAMPTZ);

ALTER TABLE "tasks"
  ALTER COLUMN "end_date" TYPE TIMESTAMPTZ(0)
    USING (("end_date"::text || ' 00:00:00+00')::TIMESTAMPTZ);
