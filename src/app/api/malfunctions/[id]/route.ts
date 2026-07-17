import { ApiError, error, handleApiError, json } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { IdRouteContext } from "@/lib/route";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  description: z.string().trim().min(3).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: IdRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;
    const data = updateSchema.parse(await request.json());

    if (data.description === undefined && data.active === undefined) {
      throw new ApiError("Nenhuma alteração informada.", 400);
    }

    const existing = await prisma.productMalfunction.findUnique({
      where: { id },
      select: {
        id: true,
        active: true,
        product: { select: { id: true, name: true } },
      },
    });
    if (!existing) return error("Registro não encontrado.", 404);

    const malfunction = await prisma.productMalfunction.update({
      where: { id },
      data: {
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.active !== undefined
          ? {
              active: data.active,
              resolvedAt: data.active ? null : new Date(),
            }
          : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            quantity: true,
          },
        },
      },
    });

    if (data.active === false && existing.active) {
      await logActivity(prisma, {
        type: "MALFUNCTION_RESOLVED",
        summary: `Mal funcionamento resolvido: ${malfunction.product.name}`,
        actor: actorFromUser(user),
        entityType: "malfunction",
        entityId: malfunction.id,
      });
    }

    return json(malfunction);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request, ctx: IdRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;
    const existing = await prisma.productMalfunction.findUnique({
      where: { id },
      select: {
        id: true,
        product: { select: { name: true } },
      },
    });
    if (!existing) return error("Registro não encontrado.", 404);

    await prisma.productMalfunction.delete({ where: { id } });

    await logActivity(prisma, {
      type: "MALFUNCTION_DELETED",
      summary: `Mal funcionamento excluído: ${existing.product.name}`,
      actor: actorFromUser(user),
      entityType: "malfunction",
      entityId: existing.id,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
