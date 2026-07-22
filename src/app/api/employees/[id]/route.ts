import { ApiError, error, handleApiError, json } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import {
  deleteEmployeePhoto,
  isEmployeePhotoValue,
} from "@/lib/employee-photos";
import {
  employeeListSelect,
  syncEmployeeAssignments,
} from "@/lib/product-assignments";
import { prisma } from "@/lib/prisma";
import type { IdRouteContext } from "@/lib/route";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const assignmentSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().min(1),
});

const optionalContactEmail = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().trim().email().nullable().optional(),
);

const updateEmployeeSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  contactEmail: optionalContactEmail,
  phone: z.string().trim().optional().nullable(),
  departmentId: z.string().trim().min(1).optional().nullable(),
  photoUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine(
      (value) => value == null || value === "" || isEmployeePhotoValue(value),
      {
        message: "photoUrl must be a stored employee photo path or data URL.",
      },
    ),
  active: z.boolean().optional(),
  assignments: z.array(assignmentSchema).optional(),
});

export async function GET(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request);
    const { id } = await ctx.params;
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        ...employeeListSelect,
        stockMovements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { product: true },
        },
      },
    });

    if (!employee) return error("Funcionário não encontrado.", 404);

    return json(employee);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, ctx: IdRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;
    const { assignments, photoUrl, departmentId, email, ...data } =
      updateEmployeeSchema.parse(await request.json());

    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, active: true },
        select: { id: true },
      });
      if (!department) {
        throw new ApiError("Departamento inválido ou inativo.", 400);
      }
    }

    const existing = await prisma.employee.findUnique({
      where: { id },
      select: {
        photoUrl: true,
        email: true,
        userId: true,
        name: true,
        departmentId: true,
        active: true,
      },
    });
    if (!existing) return error("Funcionário não encontrado.", 404);

    if (
      email !== undefined &&
      email.toLowerCase() !== existing.email.toLowerCase()
    ) {
      throw new ApiError(
        "O e-mail de login não pode ser alterado após o cadastro.",
        400,
      );
    }

    const nextPhotoUrl =
      photoUrl === undefined ? undefined : photoUrl || null;

    const linkedUserId =
      existing.userId ??
      (
        await prisma.user.findUnique({
          where: { email: existing.email },
          select: { id: true },
        })
      )?.id ??
      null;

    const employee = await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          ...data,
          ...(data.active !== undefined
            ? { suspendedByDepartment: false }
            : {}),
          ...(departmentId !== undefined
            ? { departmentId: departmentId || null }
            : {}),
          ...(nextPhotoUrl !== undefined ? { photoUrl: nextPhotoUrl } : {}),
          ...(linkedUserId && !existing.userId ? { userId: linkedUserId } : {}),
        },
      });

      if (linkedUserId) {
        const userUpdate: {
          name?: string;
          departmentId?: string | null;
          active?: boolean;
          suspendedByDepartment?: boolean;
        } = {};

        if (data.name !== undefined) userUpdate.name = data.name;
        if (departmentId !== undefined) {
          userUpdate.departmentId = departmentId || null;
        }
        if (data.active !== undefined) {
          userUpdate.active = data.active;
          userUpdate.suspendedByDepartment = false;
        }

        if (Object.keys(userUpdate).length > 0) {
          await tx.user.update({
            where: { id: linkedUserId },
            data: userUpdate,
          });
        }
      }

      if (assignments) {
        await syncEmployeeAssignments(tx, id, assignments);
      }

      const result = await tx.employee.findUniqueOrThrow({
        where: { id },
        select: employeeListSelect,
      });

      let summary = `Funcionário atualizado: ${result.name}`;
      if (data.active === false) {
        summary = `Funcionário desativado (acesso ao login bloqueado): ${result.name}`;
      } else if (data.active === true && existing.active === false) {
        summary = `Funcionário reativado (acesso ao login liberado): ${result.name}`;
      }

      await logActivity(tx, {
        type: "EMPLOYEE_UPDATED",
        summary,
        actor: actorFromUser(user),
        entityType: "employee",
        entityId: result.id,
      });

      return result;
    });

    if (
      nextPhotoUrl !== undefined &&
      existing.photoUrl &&
      existing.photoUrl !== nextPhotoUrl
    ) {
      await deleteEmployeePhoto(existing.photoUrl);
    }

    return json(employee);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request, ctx: IdRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, name: true, photoUrl: true, userId: true, email: true },
    });
    if (!employee) return error("Funcionário não encontrado.", 404);

    await prisma.$transaction(async (tx) => {
      await tx.employee.delete({ where: { id } });

      if (employee.userId) {
        await tx.user.update({
          where: { id: employee.userId },
          data: { active: false },
        });
      } else {
        await tx.user.updateMany({
          where: { email: employee.email, active: true },
          data: { active: false },
        });
      }
    });

    await deleteEmployeePhoto(employee.photoUrl);

    await logActivity(prisma, {
      type: "EMPLOYEE_DELETED",
      summary: `Funcionário excluído (acesso de login bloqueado): ${employee.name}`,
      actor: actorFromUser(user),
      entityType: "employee",
      entityId: employee.id,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
