/** Item único: estoque total ≤ 1. */
export function isUniqueProduct(product: { quantity: number }) {
  return product.quantity <= 1;
}

/**
 * Pedido bloqueado se há mau funcionamento aberto e estoque ≤ 1.
 * Com estoque > 1, o pedido continua permitido.
 */
export function canRequestProduct(product: {
  quantity: number;
  availableQuantity?: number;
  hasOpenMalfunction: boolean;
}) {
  return !(product.hasOpenMalfunction && isUniqueProduct(product));
}

export function requestBlockMessage(productName?: string) {
  return productName
    ? `"${productName}" é item único e está em mau funcionamento. Não é possível pedir.`
    : "Item único em mau funcionamento. Não é possível pedir.";
}

/** Include Prisma (só use em rotas/server). */
export const productOpenMalfunctionInclude = {
  malfunctions: {
    where: { active: true },
    select: { id: true },
    take: 1,
  },
} as const;

export const productOpenRequestInclude = {
  requests: {
    where: { status: "OPEN" as const },
    select: { id: true },
    take: 1,
  },
} as const;

export function withMalfunctionFlag<
  T extends { malfunctions?: { id: string }[] },
>(product: T) {
  const { malfunctions, ...rest } = product;
  return {
    ...rest,
    hasOpenMalfunction: (malfunctions?.length ?? 0) > 0,
  };
}

export function withOpenRequestFlag<
  T extends { requests?: { id: string }[] },
>(product: T) {
  const { requests, ...rest } = product;
  return {
    ...rest,
    hasOpenRequest: (requests?.length ?? 0) > 0,
  };
}

export function withProductDemandFlags<
  T extends {
    malfunctions?: { id: string }[];
    requests?: { id: string }[];
  },
>(product: T) {
  return withOpenRequestFlag(withMalfunctionFlag(product));
}
