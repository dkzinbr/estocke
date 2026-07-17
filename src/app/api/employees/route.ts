import { ApiError, handleApiError, json, parseBoolean } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { isEmployeePhotoPath } from "@/lib/employee-photos";
import {
  employeeListSelect,
  syncEmployeeAssignments,
} from "@/lib/product-assignments";
import { prisma } from "@/lib/prisma";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const assignmentSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().min(1),
});

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
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
  active: z.boolean().default(true),
  assignments: z.array(assignmentSchema).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const active = parseBoolean(searchParams.get("active"));

    const selfOnly = user.role === Role.EMPLOYEE;

    const employees = await prisma.employee.findMany({
      where: {
        active,
        ...(selfOnly ? { email: user.email } : {}),
        OR: search
          ? [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              {
                department: {
                  name: { contains: search, mode: "insensitive" },
                },
              },
            ]
          : undefined,
      },
      select: employeeListSelect,
      orderBy: { name: "asc" },
    });

    return json(employees);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { assignments, photoUrl, departmentId, ...data } =
      createEmployeeSchema.parse(await request.json());

    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, active: true },
        select: { id: true },
      });
      if (!department) {
        throw new ApiError("Departamento inválido ou inativo.", 400);
      }
    }

    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          ...data,
          departmentId: departmentId || null,
          photoUrl: photoUrl || null,
        },
      });

      if (assignments) {
        await syncEmployeeAssignments(tx, created.id, assignments);
      }

      const result = await tx.employee.findUniqueOrThrow({
        where: { id: created.id },
        select: employeeListSelect,
      });

      await logActivity(tx, {
        type: "EMPLOYEE_CREATED",
        summary: `Funcionário cadastrado: ${result.name}`,
        actor: actorFromUser(user),
        entityType: "employee",
        entityId: result.id,
      });

      return result;
    });

    return json(employee, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
