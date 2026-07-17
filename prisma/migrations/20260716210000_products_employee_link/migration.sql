-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "price",
ADD COLUMN     "employeeId" TEXT;

-- CreateIndex
CREATE INDEX "Product_employeeId_idx" ON "Product"("employeeId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
