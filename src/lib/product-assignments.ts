import { ApiError } from "@/lib/api";
import { recordAcquisitionMovement } from "@/lib/stock";
import type { Prisma } from "@generated/prisma/client";

export const employeeListSelect = {
  id: true,
  name: true,
  email: true,
  contactEmail: true,
  phone: true,
  photoUrl: true,
  departmentId: true,
  userId: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  department: {
    select: {
      id: true,
      name: true,
      active: true,
    },
  },
  assignments: {
    orderBy: { product: { name: "asc" as const } },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          code: true,
          quantity: true,
          minStock: true,
          active: true,
        },
      },
    },
  },
  _count: {
    select: { assignments: true },
  },
} satisfies Prisma.EmployeeSelect;

export const productAssignmentInclude = {
  assignments: {
    orderBy: { employee: { name: "asc" as const } },
    include: {
      employee: {
        select: { id: true, name: true, photoUrl: true },
      },
    },
  },
  parentLinks: {
    select: {
      id: true,
      quantity: true,
      parentId: true,
      childId: true,
    },
  },
  childLinks: {
    orderBy: { child: { name: "asc" as const } },
    include: {
      child: {
        select: {
          id: true,
          name: true,
          code: true,
          quantity: true,
          active: true,
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export type AssignmentInput = {
  productId: string;
  quantity: number;
};

type Tx = Prisma.TransactionClient;

async function linkedAsChildQuantity(
  tx: Tx,
  productId: string,
  excludeLinkId?: string,
) {
  const linked = await tx.productLink.aggregate({
    where: {
      childId: productId,
      ...(excludeLinkId ? { id: { not: excludeLinkId } } : {}),
    },
    _sum: { quantity: true },
  });
  return linked._sum.quantity ?? 0;
}

export async function syncEmployeeAssignments(
  tx: Tx,
  employeeId: string,
  assignments: AssignmentInput[],
) {
  const normalized = assignments.filter((item) => item.quantity > 0);

  const productIds = normalized.map((item) => item.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new ApiError("Produto duplicado nos vínculos.", 400);
  }

  const previous = await tx.productAssignment.findMany({
    where: { employeeId },
    select: { productId: true, quantity: true },
  });
  const previousByProduct = new Map(
    previous.map((item) => [item.productId, item.quantity]),
  );

  if (!normalized.length) {
    await tx.productAssignment.deleteMany({ where: { employeeId } });
    return;
  }

  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, quantity: true },
  });

  if (products.length !== productIds.length) {
    throw new ApiError("Um ou mais produtos não foram encontrados.", 404);
  }

  const productById = new Map(products.map((product) => [product.id, product]));

  for (const item of normalized) {
    const product = productById.get(item.productId)!;
    const others = await tx.productAssignment.aggregate({
      where: {
        productId: item.productId,
        employeeId: { not: employeeId },
      },
      _sum: { quantity: true },
    });
    const assignedOthers = others._sum.quantity ?? 0;
    const linkedQty = await linkedAsChildQuantity(tx, item.productId);

    if (assignedOthers + linkedQty + item.quantity > product.quantity) {
      const available = Math.max(
        product.quantity - assignedOthers - linkedQty,
        0,
      );
      throw new ApiError(
        `Estoque insuficiente para "${product.name}". Disponível: ${available} de ${product.quantity}.`,
        400,
      );
    }
  }

  await tx.productAssignment.deleteMany({ where: { employeeId } });

  await tx.productAssignment.createMany({
    data: normalized.map((item) => ({
      productId: item.productId,
      employeeId,
      quantity: item.quantity,
    })),
  });

  for (const item of normalized) {
    const previousQty = previousByProduct.get(item.productId) ?? 0;
    const gained = item.quantity - previousQty;
    if (gained > 0) {
      const product = productById.get(item.productId)!;
      await recordAcquisitionMovement(tx, {
        productId: item.productId,
        employeeId,
        quantity: gained,
        note: `Aquisição manual · ${product.name}`,
      });
    }
  }
}

export async function assertProductQuantityAllowsAssignments(
  tx: Tx,
  productId: string,
  nextQuantity: number,
) {
  const assigned = await tx.productAssignment.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  const totalAssigned = assigned._sum.quantity ?? 0;
  const totalLinked = await linkedAsChildQuantity(tx, productId);
  const reserved = totalAssigned + totalLinked;

  if (reserved > nextQuantity) {
    throw new ApiError(
      `Não é possível reduzir o estoque para ${nextQuantity}: já há ${reserved} unidade(s) vinculada(s) (funcionários e/ou componentes).`,
      400,
    );
  }
}

export function withAssignedQuantity<
  T extends {
    quantity: number;
    assignments?: { quantity: number }[];
    parentLinks?: { quantity: number }[];
  },
>(product: T) {
  const assignedQuantity =
    product.assignments?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const linkedQuantity =
    product.parentLinks?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return {
    ...product,
    assignedQuantity,
    linkedQuantity,
    availableQuantity: Math.max(
      product.quantity - assignedQuantity - linkedQuantity,
      0,
    ),
  };
}
