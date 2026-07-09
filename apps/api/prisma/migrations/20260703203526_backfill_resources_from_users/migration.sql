-- Backfill: crea un resource enlazado (kind='user') por cada usuario existente,
-- estableciendo la invariante "cada user real tiene 1 resource".
-- Idempotente: no duplica si el usuario ya tiene resource.
INSERT INTO "resources" ("name", "email", "kind", "status", "user_id", "avatar_url", "updated_at")
SELECT
  u."display_name",
  u."email",
  'user'::"ResourceKind",
  CASE WHEN u."status" = 'disabled' THEN 'inactive'::"ResourceStatus" ELSE 'active'::"ResourceStatus" END,
  u."id",
  u."avatar_url",
  NOW()
FROM "users" u
WHERE NOT EXISTS (SELECT 1 FROM "resources" r WHERE r."user_id" = u."id");
