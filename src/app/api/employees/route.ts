import { ApiError, handleApiError, json, parseBoolean } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { isEmployeePhotoValue } from "@/lib/employee-photos";
import {
  employeeListSelect,
  syncEmployeeAssignments,
} from "@/lib/product-assignments";
import { getDefaultUserPassword } from "@/lib/default-password";
import { prisma } from "@/lib/prisma";
import { Role } from "@generated/prisma/client";
import bcrypt from "bcrypt";
import { z } from "zod";

const assignmentSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().min(1),
});

const optionalContactEmail = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().trim().email().nullable().optional(),
);

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
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
        AND: [
          selfOnly
            ? { OR: [{ userId: user.id }, { email: user.email }] }
            : {},
          search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                  {
                    contactEmail: { contains: search, mode: "insensitive" },
                  },
                  {
                    department: {
                      name: { contains: search, mode: "insensitive" },
                    },
                  },
                ],
              }
            : {},
        ],
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
    const {
      assignments,
      photoUrl,
      departmentId,
      contactEmail,
      ...data
    } = createEmployeeSchema.parse(await request.json());

    const normalizedEmail = data.email.toLowerCase();
    const temporaryPassword = getDefaultUserPassword();

    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, active: true },
        select: { id: true },
      });
      if (!department) {
        throw new ApiError("Departamento inválido ou inativo.", 400);
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      throw new ApiError("Já existe um usuário com este e-mail.", 409);
    }

    const existingEmployee = await prisma.employee.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingEmployee) {
      throw new ApiError("Já existe um funcionário com este e-mail.", 409);
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const employee = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: data.name,
          email: normalizedEmail,
          passwordHash,
          role: Role.EMPLOYEE,
          departmentId: departmentId || null,
          active: data.active,
          mustChangePassword: true,
        },
      });

      const created = await tx.employee.create({
        data: {
          name: data.name,
          email: normalizedEmail,
          contactEmail: contactEmail || null,
          phone: data.phone || null,
          departmentId: departmentId || null,
          photoUrl: photoUrl || null,
          active: data.active,
          userId: createdUser.id,
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

    return json(
      { ...employee, temporaryPassword },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
