import type { MovementType } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api";

export function movementDelta(type: MovementType, quantity: number) {
  if (type === "IN") return quantity;
  if (type === "OUT") return -quantity;
  return quantity;
}

export function assertValidMovement(type: MovementType, quantity: number) {
  if (!Number.isInteger(quantity) || quantity === 0) {
    throw new ApiError("Quantity must be a non-zero integer.", 422);
  }

  if ((type === "IN" || type === "OUT") && quantity < 1) {
    throw new ApiError("IN and OUT movements require a positive quantity.", 422);
  }
}
