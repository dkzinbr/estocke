-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPERVISOR';

-- AlterTable
ALTER TABLE "ProductMalfunction" ADD COLUMN "reportedByEmployeeId" TEXT;

-- CreateIndex
CREATE INDEX "ProductMalfunction_reportedByEmployeeId_idx" ON "ProductMalfunction"("reportedByEmployeeId");

-- AddForeignKey
ALTER TABLE "ProductMalfunction" ADD CONSTRAINT "ProductMalfunction_reportedByEmployeeId_fkey" FOREIGN KEY ("reportedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
