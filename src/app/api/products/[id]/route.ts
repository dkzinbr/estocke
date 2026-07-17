import { error, handleApiError, json } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import {
  assertProductQuantityAllowsAssignments,
  productAssignmentInclude,
  withAssignedQuantity,
} from "@/lib/product-assignments";
import { prisma } from "@/lib/prisma";
import type { IdRouteContext } from "@/lib/route";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const updateProductSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  quantity: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export async function GET(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request);
    const { id } = await ctx.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        ...productAssignmentInclude,
        stockMovements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { employee: true },
        },
      },
    });

    if (!product) return error("Product not found.", 404);

    return json(withAssignedQuantity(product));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, ctx: IdRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;
    const data = updateProductSchema.parse(await request.json());

    const product = await prisma.$transaction(async (tx) => {
      if (data.quantity !== undefined) {
        await assertProductQuantityAllowsAssignments(tx, id, data.quantity);
      }

      const updated = await tx.product.update({
        where: { id },
        data,
        include: productAssignmentInclude,
      });

      await logActivity(tx, {
        type: "PRODUCT_UPDATED",
        summary: `Produto atualizado: ${updated.name} (${updated.code})`,
        actor: actorFromUser(user),
        entityType: "product",
        entityId: updated.id,
      });

      return updated;
    });

    return json(withAssignedQuantity(product));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request, ctx: IdRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, code: true },
    });
    if (!product) return error("Product not found.", 404);

    await prisma.product.delete({ where: { id } });

    await logActivity(prisma, {
      type: "PRODUCT_DELETED",
      summary: `Produto excluído: ${product.name} (${product.code})`,
      actor: actorFromUser(user),
      entityType: "product",
      entityId: product.id,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
