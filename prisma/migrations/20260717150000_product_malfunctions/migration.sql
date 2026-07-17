-- CreateTable
CREATE TABLE "ProductMalfunction" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ProductMalfunction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductMalfunction_productId_idx" ON "ProductMalfunction"("productId");

-- CreateIndex
CREATE INDEX "ProductMalfunction_active_idx" ON "ProductMalfunction"("active");

-- CreateIndex
CREATE INDEX "ProductMalfunction_createdAt_idx" ON "ProductMalfunction"("createdAt");

-- AddForeignKey
ALTER TABLE "ProductMalfunction" ADD CONSTRAINT "ProductMalfunction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
