import { error, handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { IdRouteContext } from "@/lib/route";
import { z } from "zod";

const updateProductSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  quantity: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  price: z.coerce.number().min(0).optional(),
  active: z.boolean().optional(),
});

export async function GET(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request);
    const { id } = await ctx.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        stockMovements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { employee: true },
        },
      },
    });

    if (!product) return error("Product not found.", 404);

    return json(product);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request);
    const { id } = await ctx.params;
    const data = updateProductSchema.parse(await request.json());
    const product = await prisma.product.update({
      where: { id },
      data,
    });

    return json(product);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request);
    const { id } = await ctx.params;
    await prisma.product.delete({ where: { id } });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
