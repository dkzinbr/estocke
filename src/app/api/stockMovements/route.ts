import { ApiError, handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertValidMovement, movementDelta } from "@/lib/stock";
import { z } from "zod";

const movementTypeSchema = z.enum(["IN", "OUT", "ADJUSTMENT"]);

const createStockMovementSchema = z.object({
  productId: z.string().trim().min(1),
  employeeId: z.string().trim().min(1).optional().nullable(),
  type: movementTypeSchema,
  quantity: z.number().int(),
  note: z.string().trim().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId") ?? undefined;
    const employeeId = searchParams.get("employeeId") ?? undefined;
    const typeParam = searchParams.get("type");
    const type = typeParam
      ? movementTypeSchema.parse(typeParam)
      : undefined;

    const stockMovements = await prisma.stockMovement.findMany({
      where: {
        productId,
        employeeId,
        type,
      },
      orderBy: { createdAt: "desc" },
      include: {
        product: true,
        employee: true,
      },
    });

    return json(stockMovements);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const data = createStockMovementSchema.parse(await request.json());
    assertValidMovement(data.type, data.quantity);

    const stockMovement = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({
        where: { id: data.productId },
      });
      const delta = movementDelta(data.type, data.quantity);
      const nextQuantity = product.quantity + delta;

      if (nextQuantity < 0) {
        throw new ApiError("Insufficient stock for this movement.", 409);
      }

      await tx.product.update({
        where: { id: data.productId },
        data: { quantity: nextQuantity },
      });

      return tx.stockMovement.create({
        data,
        include: {
          product: true,
          employee: true,
        },
      });
    });

    return json(stockMovement, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
