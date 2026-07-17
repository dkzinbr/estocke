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
      select: { id: true, role: true, active: true },
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

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
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

    await logActivity(prisma, {
      type: "USER_UPDATED",
      summary: `Usuário atualizado: ${user.name}`,
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
