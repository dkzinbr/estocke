import { ApiError, error, handleApiError, json } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { withAssignedQuantity } from "@/lib/product-assignments";
import { getStockStatus } from "@/lib/product-status";
import { prisma } from "@/lib/prisma";
import type { IdRouteContext } from "@/lib/route";
import { recordAcquisitionMovement } from "@/lib/stock";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["OPEN", "FULFILLED", "CANCELLED"]).optional(),
  note: z.string().trim().optional().nullable(),
});

const requestInclude = {
  employee: {
    select: {
      id: true,
      name: true,
      email: true,
      photoUrl: true,
      department: {
        select: { id: true, name: true },
      },
    },
  },
  product: {
    include: {
      assignments: {
        select: { quantity: true },
      },
      parentLinks: {
        select: { quantity: true },
      },
      malfunctions: {
        where: { active: true },
        select: { id: true },
        take: 1,
      },
      requests: {
        where: { status: "OPEN" },
        select: { id: true },
        take: 1,
      },
    },
  },
} as const;

export async function PATCH(request: Request, ctx: IdRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id } = await ctx.params;
    const data = updateSchema.parse(await request.json());

    if (data.status === undefined && data.note === undefined) {
      throw new ApiError("Nenhuma alteração informada.", 400);
    }

    const existing = await prisma.productRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true } },
        product: {
          include: {
            assignments: { select: { quantity: true, employeeId: true } },
            parentLinks: { select: { quantity: true } },
          },
        },
      },
    });
    if (!existing) return error("Pedido não encontrado.", 404);

    const updated = await prisma.$transaction(async (tx) => {
      if (data.status === "FULFILLED" && existing.status !== "FULFILLED") {
        const product = withAssignedQuantity(existing.product);
        if (product.availableQuantity < 1) {
          throw new ApiError(
            "Não há unidade disponível para vincular a este funcionário.",
            400,
          );
        }

        const current = await tx.productAssignment.findUnique({
          where: {
            productId_employeeId: {
              productId: existing.productId,
              employeeId: existing.employeeId,
            },
          },
        });

        if (current) {
          await tx.productAssignment.update({
            where: { id: current.id },
            data: { quantity: current.quantity + 1 },
          });
        } else {
          await tx.productAssignment.create({
            data: {
              productId: existing.productId,
              employeeId: existing.employeeId,
              quantity: 1,
            },
          });
        }

        await recordAcquisitionMovement(tx, {
          productId: existing.productId,
          employeeId: existing.employeeId,
          quantity: 1,
          note: `Aquisição via pedido · ${existing.product.name}`,
          actor: actorFromUser(user),
          productName: existing.product.name,
          employeeName: existing.employee.name,
        });
      }

      const result = await tx.productRequest.update({
        where: { id },
        data: {
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.note !== undefined ? { note: data.note || null } : {}),
        },
        include: requestInclude,
      });

      if (data.status === "FULFILLED" && existing.status !== "FULFILLED") {
        await logActivity(tx, {
          type: "REQUEST_FULFILLED",
          summary: `Pedido atendido: ${existing.product.name} para ${existing.employee.name}`,
          actor: actorFromUser(user),
          entityType: "request",
          entityId: result.id,
        });
      } else if (
        data.status === "CANCELLED" &&
        existing.status !== "CANCELLED"
      ) {
        await logActivity(tx, {
          type: "REQUEST_CANCELLED",
          summary: `Pedido cancelado: ${existing.product.name} para ${existing.employee.name}`,
          actor: actorFromUser(user),
          entityType: "request",
          entityId: result.id,
        });
      }

      return result;
    });

    const product = withAssignedQuantity(updated.product);
    const hasOpenMalfunction =
      (updated.product.malfunctions?.length ?? 0) > 0;
    const hasOpenRequest = (updated.product.requests?.length ?? 0) > 0;
    return json({
      ...updated,
      product: {
        ...product,
        hasOpenMalfunction,
        hasOpenRequest,
        stockStatus: getStockStatus({
          ...product,
          hasOpenMalfunction,
          hasOpenRequest,
        }),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
