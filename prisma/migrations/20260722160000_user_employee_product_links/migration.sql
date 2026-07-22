-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PRODUCT_LINKED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PRODUCT_UNLINKED';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key" ON "Employee"("userId");
CREATE INDEX IF NOT EXISTS "Employee_contactEmail_idx" ON "Employee"("contactEmail");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Employee_userId_fkey'
  ) THEN
    ALTER TABLE "Employee"
      ADD CONSTRAINT "Employee_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductLink" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductLink_parentId_childId_key" ON "ProductLink"("parentId", "childId");
CREATE INDEX IF NOT EXISTS "ProductLink_parentId_idx" ON "ProductLink"("parentId");
CREATE INDEX IF NOT EXISTS "ProductLink_childId_idx" ON "ProductLink"("childId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductLink_parentId_fkey'
  ) THEN
    ALTER TABLE "ProductLink"
      ADD CONSTRAINT "ProductLink_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "Product"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductLink_childId_fkey'
  ) THEN
    ALTER TABLE "ProductLink"
      ADD CONSTRAINT "ProductLink_childId_fkey"
      FOREIGN KEY ("childId") REFERENCES "Product"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Link existing employees ↔ users by email
UPDATE "Employee" e
SET "userId" = u.id
FROM "User" u
WHERE lower(e.email) = lower(u.email)
  AND e."userId" IS NULL;
