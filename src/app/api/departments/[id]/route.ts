import { ApiError, error, handleApiError, json } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { IdRouteContext } from "@/lib/route";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const memberSelect = {
  id: true,
  name: true,
  email: true,
  contactEmail: true,
  phone: true,
  active: true,
  userId: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      role: true,
    },
  },
} as const;

const moveMemberSchema = z.object({
  employeeId: z.string().trim().min(1),
  departmentId: z.string().trim().min(1).nullable(),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  active: z.boolean().optional(),
  moveMembers: z.array(moveMemberSchema).optional(),
});

export async function GET(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;

    const department = await prisma.department.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        employees: {
          select: memberSelect,
          orderBy: { name: "asc" },
        },
        _count: { select: { users: true, employees: true } },
      },
    });

    if (!department) return error("Departamento não encontrado.", 404);

    return json(department);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, ctx: IdRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;
    const data = updateSchema.parse(await request.json());

    if (
      data.name === undefined &&
      data.active === undefined &&
      data.moveMembers === undefined
    ) {
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

    if (data.moveMembers?.length) {
      const targetIds = [
        ...new Set(
          data.moveMembers
            .map((item) => item.departmentId)
            .filter((value): value is string => !!value),
        ),
      ];

      if (targetIds.length) {
        const targets = await prisma.department.findMany({
          where: { id: { in: targetIds }, active: true },
          select: { id: true },
        });
        if (targets.length !== targetIds.length) {
          throw new ApiError(
            "Departamento de destino inválido ou inativo.",
            400,
          );
        }
      }

      const employeeIds = data.moveMembers.map((item) => item.employeeId);
      const employees = await prisma.employee.findMany({
        where: { id: { in: employeeIds }, departmentId: id },
        select: { id: true, userId: true },
      });
      if (employees.length !== employeeIds.length) {
        throw new ApiError(
          "Um ou mais funcionários não pertencem a este departamento.",
          400,
        );
      }
    }

    const department = await prisma.$transaction(async (tx) => {
      if (data.moveMembers?.length) {
        for (const move of data.moveMembers) {
          const employee = await tx.employee.update({
            where: { id: move.employeeId },
            data: { departmentId: move.departmentId },
            select: { id: true, userId: true, name: true },
          });

          if (employee.userId) {
            await tx.user.update({
              where: { id: employee.userId },
              data: { departmentId: move.departmentId },
            });
          }
        }
      }

      if (data.active !== undefined && data.active !== existing.active) {
        await tx.employee.updateMany({
          where: { departmentId: id },
          data: { active: data.active },
        });
        await tx.user.updateMany({
          where: { departmentId: id },
          data: { active: data.active },
        });
      }

      return tx.department.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
        },
        select: {
          id: true,
          name: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          employees: {
            select: memberSelect,
            orderBy: { name: "asc" },
          },
          _count: { select: { users: true, employees: true } },
        },
      });
    });

    const summaryParts: string[] = [];
    if (data.name) summaryParts.push(`nome → ${department.name}`);
    if (data.active === false) {
      summaryParts.push("desativado (usuários e funcionários bloqueados)");
    } else if (data.active === true) {
      summaryParts.push("reativado (usuários e funcionários liberados)");
    }
    if (data.moveMembers?.length) {
      summaryParts.push(`${data.moveMembers.length} pessoa(s) transferida(s)`);
    }

    await logActivity(prisma, {
      type: "DEPARTMENT_UPDATED",
      summary: `Departamento atualizado: ${department.name}${
        summaryParts.length ? ` (${summaryParts.join("; ")})` : ""
      }`,
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
