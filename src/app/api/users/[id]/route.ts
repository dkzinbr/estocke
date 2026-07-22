import { ApiError, error, handleApiError, json } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { IdRouteContext } from "@/lib/route";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const updateUserSchema = z.object({
  role: z.enum(["ADMIN", "SUPERVISOR", "EMPLOYEE"]).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: IdRouteContext) {
  try {
    const admin = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;
    const data = updateUserSchema.parse(await request.json());

    if (data.role === undefined && data.active === undefined) {
      throw new ApiError("Nenhuma alteração informada.", 400);
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, active: true, email: true },
    });

    if (!existing) return error("Usuário não encontrado.", 404);

    const nextRole = data.role ?? existing.role;
    const nextActive = data.active ?? existing.active;

    if (
      existing.role === Role.ADMIN &&
      (nextRole !== Role.ADMIN || nextActive === false)
    ) {
      const adminCount = await prisma.user.count({
        where: { role: Role.ADMIN, active: true },
      });

      if (adminCount <= 1) {
        throw new ApiError(
          "Não é possível remover o último administrador ativo.",
          400,
        );
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(data.role !== undefined ? { role: data.role } : {}),
          ...(data.active !== undefined
            ? { active: data.active, suspendedByDepartment: false }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Espelha o status no funcionário vinculado (acesso isolado 1:1).
      if (data.active !== undefined) {
        await tx.employee.updateMany({
          where: {
            OR: [{ userId: updated.id }, { email: existing.email }],
          },
          data: { active: data.active, suspendedByDepartment: false },
        });
      }

      return updated;
    });

    await logActivity(prisma, {
      type: "USER_UPDATED",
      summary:
        data.active === false
          ? `Usuário desativado (acesso bloqueado): ${user.name}`
          : data.active === true && existing.active === false
            ? `Usuário reativado (acesso liberado): ${user.name}`
            : `Usuário atualizado: ${user.name}`,
      actor: actorFromUser(admin),
      entityType: "user",
      entityId: user.id,
    });

    return json({
      ...user,
      sessionInvalidated: user.id === admin.id && user.role !== admin.role,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
