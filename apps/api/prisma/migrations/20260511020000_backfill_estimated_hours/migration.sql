-- Backfill idempotente de tasks.estimated_hours desde tasks.duration.
-- Para tasks con estimated_hours = 0 y duration > 0:
--   estimated_hours = duration * hoursPerDay(calendar_resolvido)
-- donde hoursPerDay viene del calendar del proyecto (si existe)
-- y si no, del calendar GLOBAL. Si ninguno aplica, fallback a 8h.

UPDATE "tasks" t
SET "estimated_hours" = ROUND(
  (
    t."duration"::numeric * COALESCE(
      (
        SELECT AVG(
          EXTRACT(EPOCH FROM (wdp."day_end" - wdp."day_start")) / 3600.0
          - COALESCE(
              EXTRACT(EPOCH FROM (wdp."break_end" - wdp."break_start")) / 3600.0,
              0
            )
        )
        FROM "working_calendars" wc
        JOIN "working_day_patterns" wdp
          ON wdp."calendar_id" = wc."id"
         AND wdp."enabled" = TRUE
         AND wdp."day_start" IS NOT NULL
         AND wdp."day_end"   IS NOT NULL
        WHERE wc."project_id" = t."project_id"
      ),
      (
        SELECT AVG(
          EXTRACT(EPOCH FROM (wdp."day_end" - wdp."day_start")) / 3600.0
          - COALESCE(
              EXTRACT(EPOCH FROM (wdp."break_end" - wdp."break_start")) / 3600.0,
              0
            )
        )
        FROM "working_calendars" wc
        JOIN "working_day_patterns" wdp
          ON wdp."calendar_id" = wc."id"
         AND wdp."enabled" = TRUE
         AND wdp."day_start" IS NOT NULL
         AND wdp."day_end"   IS NOT NULL
        WHERE wc."scope" = 'global'
      ),
      8
    )
  )::numeric,
  2
)
WHERE t."estimated_hours" = 0 AND t."duration" > 0;
