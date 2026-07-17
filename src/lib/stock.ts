import type { MovementType, Prisma } from "@generated/prisma/client";
import { ApiError } from "@/lib/api";
import { logActivity, type ActivityActor } from "@/lib/activity";

export function movementDelta(type: MovementType, quantity: number) {
  if (type === "IN") return quantity;
  if (type === "OUT") return -quantity;
  return quantity;
}

export function assertValidMovement(type: MovementType, quantity: number) {
  if (!Number.isInteger(quantity) || quantity === 0) {
    throw new ApiError("A quantidade deve ser um inteiro diferente de zero.", 422);
  }

  if ((type === "IN" || type === "OUT") && quantity < 1) {
    throw new ApiError(
      "Movimentos de entrada e saída exigem quantidade positiva.",
      422,
    );
  }
}

type Tx = Prisma.TransactionClient;

/** Histórico de aquisição. Não altera product.quantity — o vínculo já reserva. */
export async function recordAcquisitionMovement(
  tx: Tx,
  params: {
    productId: string;
    employeeId: string;
    quantity: number;
    note: string;
    actor?: ActivityActor | null;
    productName?: string;
    employeeName?: string;
  },
) {
  assertValidMovement("OUT", params.quantity);

  const movement = await tx.stockMovement.create({
    data: {
      productId: params.productId,
      employeeId: params.employeeId,
      type: "OUT",
      quantity: params.quantity,
      note: params.note,
    },
  });

  await logActivity(tx, {
    type: "ASSIGNMENT_ACQUIRED",
    summary: params.note,
    detail: params.employeeName
      ? `${params.quantity} un. · ${params.employeeName}`
      : `${params.quantity} unidade(s)`,
    actor: params.actor,
    entityType: "product",
    entityId: params.productId,
  });

  return movement;
}

/** Histórico de mal funcionamento. Não altera product.quantity. */
export async function recordMalfunctionMovement(
  tx: Tx,
  params: {
    productId: string;
    employeeId?: string | null;
    quantity: number;
    note: string;
    actor?: ActivityActor | null;
  },
) {
  assertValidMovement("OUT", params.quantity);

  const movement = await tx.stockMovement.create({
    data: {
      productId: params.productId,
      employeeId: params.employeeId || null,
      type: "OUT",
      quantity: params.quantity,
      note: params.note,
    },
  });

  await logActivity(tx, {
    type: "MALFUNCTION_MOVEMENT",
    summary: params.note,
    detail: `${params.quantity} unidade(s)`,
    actor: params.actor,
    entityType: "product",
    entityId: params.productId,
  });

  return movement;
}
