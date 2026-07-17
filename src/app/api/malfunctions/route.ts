import { ApiError, handleApiError, json, parseBoolean } from "@/lib/api";
import {
  canManageAllRequests,
  requireLinkedEmployee,
} from "@/lib/access";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordMalfunctionMovement } from "@/lib/stock";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const createSchema = z.object({
  productId: z.string().trim().min(1),
  description: z
    .string()
    .trim()
    .min(3, "Descreva o problema com pelo menos 3 caracteres."),
});

const malfunctionInclude = {
  product: {
    select: {
      id: true,
      name: true,
      code: true,
      quantity: true,
    },
  },
  reportedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      department: {
        select: { id: true, name: true },
      },
    },
  },
} as const;

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const activeParam = searchParams.get("active");
    const active =
      activeParam === "all"
        ? undefined
        : activeParam === null
          ? true
          : parseBoolean(activeParam);

    const selfEmployee = canManageAllRequests(user.role)
      ? null
      : await requireLinkedEmployee(user);

    const malfunctions = await prisma.productMalfunction.findMany({
      where: {
        ...(active !== undefined ? { active } : {}),
        ...(selfEmployee
          ? {
              OR: [
                { reportedByEmployeeId: selfEmployee.id },
                {
                  product: {
                    assignments: { some: { employeeId: selfEmployee.id } },
                  },
                },
              ],
            }
          : {}),
        AND: search
          ? [
              {
                OR: [
                  {
                    description: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    product: {
                      name: { contains: search, mode: "insensitive" },
                    },
                  },
                  {
                    product: {
                      code: { contains: search, mode: "insensitive" },
                    },
                  },
                ],
              },
            ]
          : undefined,
      },
      include: malfunctionInclude,
      orderBy: { createdAt: "desc" },
    });

    return json(malfunctions);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const data = createSchema.parse(await request.json());

    const selfEmployee =
      user.role === Role.ADMIN
        ? await prisma.employee.findUnique({ where: { email: user.email } })
        : await requireLinkedEmployee(user);

    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { id: true, name: true },
    });

    if (!product) {
      throw new ApiError("Produto não encontrado.", 404);
    }

    if (user.role !== Role.ADMIN) {
      const owned = await prisma.productAssignment.findFirst({
        where: {
          productId: data.productId,
          employeeId: selfEmployee!.id,
        },
        select: { id: true },
      });
      if (!owned) {
        throw new ApiError(
          "Você só pode registrar mal funcionamento de produtos vinculados a você.",
          403,
        );
      }
    }

    const openIssue = await prisma.productMalfunction.findFirst({
      where: { productId: data.productId, active: true },
      select: { id: true },
    });

    if (openIssue) {
      throw new ApiError(
        "Este produto já possui um mal funcionamento aberto. Resolva-o antes de registrar outro.",
        409,
      );
    }

    const noteBase = `Mal funcionamento · ${product.name}`;
    const noteDetail =
      data.description.length > 80
        ? `${data.description.slice(0, 77)}...`
        : data.description;

    const malfunction = await prisma.$transaction(async (tx) => {
      const assignments = await tx.productAssignment.findMany({
        where: { productId: data.productId },
        select: { employeeId: true, quantity: true },
      });

      await tx.productAssignment.deleteMany({
        where: { productId: data.productId },
      });

      const actor = actorFromUser(user);

      if (assignments.length) {
        for (const assignment of assignments) {
          await recordMalfunctionMovement(tx, {
            productId: data.productId,
            employeeId: assignment.employeeId,
            quantity: assignment.quantity,
            note: `${noteBase}: ${noteDetail}`,
            actor,
          });
        }
      } else {
        await recordMalfunctionMovement(tx, {
          productId: data.productId,
          employeeId: selfEmployee?.id ?? null,
          quantity: 1,
          note: `${noteBase}: ${noteDetail}`,
          actor,
        });
      }

      const created = await tx.productMalfunction.create({
        data: {
          productId: data.productId,
          description: data.description,
          reportedByEmployeeId: selfEmployee?.id ?? null,
        },
        include: malfunctionInclude,
      });

      await logActivity(tx, {
        type: "MALFUNCTION_REPORTED",
        summary: `Mal funcionamento: ${product.name}`,
        detail: data.description,
        actor,
        entityType: "malfunction",
        entityId: created.id,
      });

      return created;
    });

    return json(malfunction, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
