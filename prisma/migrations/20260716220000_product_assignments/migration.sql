-- CreateTable
CREATE TABLE "ProductAssignment" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAssignment_pkey" PRIMARY KEY ("id")
);

-- Migrate existing Product.employeeId links into assignments
INSERT INTO "ProductAssignment" ("id", "productId", "employeeId", "quantity", "createdAt", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text || "id"),
    "id",
    "employeeId",
    GREATEST("quantity", 1),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Product"
WHERE "employeeId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_employeeId_fkey";

-- DropIndex
DROP INDEX "Product_employeeId_idx";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "employeeId";

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssignment_productId_employeeId_key" ON "ProductAssignment"("productId", "employeeId");

-- CreateIndex
CREATE INDEX "ProductAssignment_productId_idx" ON "ProductAssignment"("productId");

-- CreateIndex
CREATE INDEX "ProductAssignment_employeeId_idx" ON "ProductAssignment"("employeeId");

-- AddForeignKey
ALTER TABLE "ProductAssignment" ADD CONSTRAINT "ProductAssignment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssignment" ADD CONSTRAINT "ProductAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
