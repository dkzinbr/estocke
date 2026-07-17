import { ApiError, error, handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { employeeMovementInclude } from "@/lib/employee-select";
import { prisma } from "@/lib/prisma";
import type { IdRouteContext } from "@/lib/route";
import { assertValidMovement, movementDelta } from "@/lib/stock";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const movementTypeSchema = z.enum(["IN", "OUT", "ADJUSTMENT"]);

const updateStockMovementSchema = z.object({
  productId: z.string().trim().min(1).optional(),
  employeeId: z.string().trim().min(1).optional().nullable(),
  type: movementTypeSchema.optional(),
  quantity: z.number().int().optional(),
  note: z.string().trim().optional().nullable(),
});

export async function GET(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request);
    const { id } = await ctx.params;
    const stockMovement = await prisma.stockMovement.findUnique({
      where: { id },
      include: employeeMovementInclude,
    });

    if (!stockMovement) return error("Stock movement not found.", 404);

    return json(stockMovement);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;
    const data = updateStockMovementSchema.parse(await request.json());

    const stockMovement = await prisma.$transaction(async (tx) => {
      const current = await tx.stockMovement.findUniqueOrThrow({ where: { id } });
      const next = {
        productId: data.productId ?? current.productId,
        type: data.type ?? current.type,
        quantity: data.quantity ?? current.quantity,
      };

      assertValidMovement(next.type, next.quantity);

      const currentDelta = movementDelta(current.type, current.quantity);
      const nextDelta = movementDelta(next.type, next.quantity);

      if (current.productId === next.productId) {
        const product = await tx.product.findUniqueOrThrow({
          where: { id: current.productId },
        });
        const nextQuantity = product.quantity - currentDelta + nextDelta;

        if (nextQuantity < 0) {
          throw new ApiError("Insufficient stock for this movement.", 409);
        }

        await tx.product.update({
          where: { id: current.productId },
          data: { quantity: nextQuantity },
        });
      } else {
        const currentProduct = await tx.product.findUniqueOrThrow({
          where: { id: current.productId },
        });
        const nextProduct = await tx.product.findUniqueOrThrow({
          where: { id: next.productId },
        });
        const revertedQuantity = currentProduct.quantity - currentDelta;
        const appliedQuantity = nextProduct.quantity + nextDelta;

        if (revertedQuantity < 0 || appliedQuantity < 0) {
          throw new ApiError("Insufficient stock for this movement.", 409);
        }

        await tx.product.update({
          where: { id: current.productId },
          data: { quantity: revertedQuantity },
        });
        await tx.product.update({
          where: { id: next.productId },
          data: { quantity: appliedQuantity },
        });
      }

      return tx.stockMovement.update({
        where: { id },
        data,
        include: {
          product: true,
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              photoUrl: true,
              department: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
    });

    return json(stockMovement);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;

    await prisma.$transaction(async (tx) => {
      const stockMovement = await tx.stockMovement.findUniqueOrThrow({
        where: { id },
      });
      const product = await tx.product.findUniqueOrThrow({
        where: { id: stockMovement.productId },
      });
      const nextQuantity =
        product.quantity -
        movementDelta(stockMovement.type, stockMovement.quantity);

      if (nextQuantity < 0) {
        throw new ApiError("Cannot remove movement without negative stock.", 409);
      }

      await tx.product.update({
        where: { id: product.id },
        data: { quantity: nextQuantity },
      });
      await tx.stockMovement.delete({ where: { id } });
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
