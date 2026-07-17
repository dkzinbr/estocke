import { ApiError, error, handleApiError, json } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { deleteEmployeePhoto, isEmployeePhotoPath } from "@/lib/employee-photos";
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

const updateEmployeeSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().optional().nullable(),
  departmentId: z.string().trim().min(1).optional().nullable(),
  photoUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((value) => value == null || value === "" || isEmployeePhotoPath(value), {
      message: "photoUrl must be a stored employee photo path.",
    }),
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

    if (!employee) return error("Employee not found.", 404);

    return json(employee);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, ctx: IdRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;
    const { assignments, photoUrl, departmentId, ...data } =
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
      select: { photoUrl: true },
    });
    if (!existing) return error("Employee not found.", 404);

    const nextPhotoUrl =
      photoUrl === undefined ? undefined : photoUrl || null;

    const employee = await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          ...data,
          ...(departmentId !== undefined
            ? { departmentId: departmentId || null }
            : {}),
          ...(nextPhotoUrl !== undefined ? { photoUrl: nextPhotoUrl } : {}),
        },
      });

      if (assignments) {
        await syncEmployeeAssignments(tx, id, assignments);
      }

      const result = await tx.employee.findUniqueOrThrow({
        where: { id },
        select: employeeListSelect,
      });

      await logActivity(tx, {
        type: "EMPLOYEE_UPDATED",
        summary: `Funcionário atualizado: ${result.name}`,
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
      select: { id: true, name: true, photoUrl: true },
    });
    if (!employee) return error("Employee not found.", 404);

    await prisma.employee.delete({ where: { id } });
    await deleteEmployeePhoto(employee.photoUrl);

    await logActivity(prisma, {
      type: "EMPLOYEE_DELETED",
      summary: `Funcionário excluído: ${employee.name}`,
      actor: actorFromUser(user),
      entityType: "employee",
      entityId: employee.id,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
