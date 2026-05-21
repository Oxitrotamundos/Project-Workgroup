-- Optimistic locking: monotonic version counter per row.
ALTER TABLE "tasks" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "task_links" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
