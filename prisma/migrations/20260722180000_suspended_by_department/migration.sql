-- AlterTable
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "suspendedByDepartment" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedByDepartment" BOOLEAN NOT NULL DEFAULT false;
