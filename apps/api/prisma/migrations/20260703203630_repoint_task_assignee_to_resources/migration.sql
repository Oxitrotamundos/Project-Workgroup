-- Repoint tasks.assignee_id de users → resources.
-- assignee_id guardaba users.id; hay que remapearlo al resource enlazado (resources.user_id)
-- mientras el FK está caído. La migración de backfill previa garantiza que todo user tiene resource.

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assignee_id_fkey";

-- Anula (avisando) los assignees sin resource enlazado ANTES de remapear: así un users.id
-- residual nunca se confunde con un resources.id válido de otra entidad. No debería ocurrir
-- gracias al backfill; es una red de seguridad.
DO $$
DECLARE orphaned INT;
BEGIN
  SELECT count(*) INTO orphaned FROM "tasks" t
  WHERE t."assignee_id" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "resources" r WHERE r."user_id" = t."assignee_id");
  IF orphaned > 0 THEN
    RAISE WARNING 'tasks: % assignee_id sin resource enlazado; se anulan', orphaned;
    UPDATE "tasks" t SET "assignee_id" = NULL
    WHERE t."assignee_id" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "resources" r WHERE r."user_id" = t."assignee_id");
  END IF;
END $$;

-- Remap users.id → resources.id vía el puente resources.user_id
UPDATE "tasks" t
SET "assignee_id" = r."id"
FROM "resources" r
WHERE r."user_id" = t."assignee_id"
  AND t."assignee_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
