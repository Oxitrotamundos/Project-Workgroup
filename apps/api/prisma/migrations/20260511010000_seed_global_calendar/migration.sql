-- Seed inicial del calendario GLOBAL: jornada L-V 9:00-13:00 / 14:00-18:00, tz America/Lima.
-- Idempotente: si ya existe un calendar global, no inserta nada.

DO $$
DECLARE
  cal_id BIGINT;
BEGIN
  SELECT "id" INTO cal_id FROM "working_calendars" WHERE "scope" = 'global' LIMIT 1;

  IF cal_id IS NULL THEN
    INSERT INTO "working_calendars" ("scope", "project_id", "name", "timezone", "updated_at")
      VALUES ('global', NULL, 'Estándar (L-V, 8h con pausa de comida)', 'America/Lima', NOW())
      RETURNING "id" INTO cal_id;

    INSERT INTO "working_day_patterns"
      ("calendar_id", "weekday", "enabled", "day_start", "break_start", "break_end", "day_end")
    VALUES
      (cal_id, 0, false, NULL,        NULL,        NULL,        NULL),
      (cal_id, 1, true,  '09:00:00',  '13:00:00',  '14:00:00',  '18:00:00'),
      (cal_id, 2, true,  '09:00:00',  '13:00:00',  '14:00:00',  '18:00:00'),
      (cal_id, 3, true,  '09:00:00',  '13:00:00',  '14:00:00',  '18:00:00'),
      (cal_id, 4, true,  '09:00:00',  '13:00:00',  '14:00:00',  '18:00:00'),
      (cal_id, 5, true,  '09:00:00',  '13:00:00',  '14:00:00',  '18:00:00'),
      (cal_id, 6, false, NULL,        NULL,        NULL,        NULL);
  END IF;
END $$;
