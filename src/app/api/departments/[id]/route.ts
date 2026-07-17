import { ApiError, error, handleApiError, json } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { IdRouteContext } from "@/lib/route";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: IdRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;
    const data = updateSchema.parse(await request.json());

    if (data.name === undefined && data.active === undefined) {
      throw new ApiError("Nenhuma alteração informada.", 400);
    }

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) return error("Departamento não encontrado.", 404);

    if (data.name) {
      const conflict = await prisma.department.findFirst({
        where: {
          id: { not: id },
          name: { equals: data.name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new ApiError("Já existe um departamento com este nome.", 409);
      }
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
      include: {
        _count: { select: { users: true, employees: true } },
      },
    });

    await logActivity(prisma, {
      type: "DEPARTMENT_UPDATED",
      summary: `Departamento atualizado: ${department.name}`,
      actor: actorFromUser(user),
      entityType: "department",
      entityId: department.id,
    });

    return json(department);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request, ctx: IdRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;

    const existing = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, employees: true } },
      },
    });
    if (!existing) return error("Departamento não encontrado.", 404);

    if (existing._count.users > 0 || existing._count.employees > 0) {
      throw new ApiError(
        "Não é possível excluir um departamento com usuários ou funcionários vinculados. Desative-o.",
        409,
      );
    }

    await prisma.department.delete({ where: { id } });

    await logActivity(prisma, {
      type: "DEPARTMENT_DELETED",
      summary: `Departamento excluído: ${existing.name}`,
      actor: actorFromUser(user),
      entityType: "department",
      entityId: existing.id,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
