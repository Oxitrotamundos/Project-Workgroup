-- Repoint workload de users → resources. Renombra la columna (preserva datos) y remapea
-- los valores users.id → resources.id vía el puente resources.user_id. resource_id es NOT NULL,
-- así que los huérfanos (sin resource enlazado) se eliminan en vez de anularse.

-- Renombra la columna: los índices que la referencian la siguen automáticamente.
ALTER TABLE "workload" RENAME COLUMN "user_id" TO "resource_id";

-- El FK aún apunta a users; lo quitamos para remapear.
ALTER TABLE "workload" DROP CONSTRAINT "workload_user_id_fkey";

-- Elimina (avisando) las filas sin resource enlazado ANTES de remapear, para no confundir
-- un users.id residual con un resources.id válido de otra entidad. No debería ocurrir gracias
-- al backfill; es una red de seguridad.
DO $$
DECLARE orphaned INT;
BEGIN
  SELECT count(*) INTO orphaned FROM "workload" w
  WHERE NOT EXISTS (SELECT 1 FROM "resources" r WHERE r."user_id" = w."resource_id");
  IF orphaned > 0 THEN
    RAISE WARNING 'workload: % filas sin resource enlazado; se eliminan', orphaned;
    DELETE FROM "workload" w
    WHERE NOT EXISTS (SELECT 1 FROM "resources" r WHERE r."user_id" = w."resource_id");
  END IF;
END $$;

-- Remap users.id → resources.id vía el puente resources.user_id.
UPDATE "workload" w
SET "resource_id" = r."id"
FROM "resources" r
WHERE r."user_id" = w."resource_id";

-- Renombra el índice para que cuadre con el nombre por defecto que Prisma espera.
-- El índice único (workload_task_user_date_unique) conserva su nombre y sigue a la columna.
ALTER INDEX "workload_user_id_date_idx" RENAME TO "workload_resource_id_date_idx";

-- FK nuevo hacia resources.
ALTER TABLE "workload" ADD CONSTRAINT "workload_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
