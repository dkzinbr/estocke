export type StockStatus =
  | "in_stock"
  | "attention"
  | "out_of_stock"
  | "malfunction";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: "Em estoque",
  attention: "Estoque baixo",
  out_of_stock: "Pedido aberto",
  malfunction: "Mau funcionamento",
};

export const STOCK_STATUS_TONES: Record<StockStatus, string> = {
  in_stock: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  attention: "bg-amber-400/20 text-amber-700 dark:text-amber-300",
  out_of_stock: "bg-adc-danger-bg text-adc-danger-text",
  malfunction: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
};

/**
 * Status do produto:
 * - Mau funcionamento: mau funcionamento aberto e estoque total ≤ 1
 * - Pedido aberto: estoque zerado OU pedido aberto
 * - Estoque baixo: disponíveis ≤ mínimo configurado
 * - Em estoque: disponíveis acima do mínimo
 *
 * O mínimo (`minStock`) refere-se a unidades **ainda disponíveis**
 * (não vinculadas), não ao total cadastrado.
 */
export function getStockStatus(product: {
  quantity: number;
  availableQuantity: number;
  minStock?: number;
  hasOpenMalfunction?: boolean;
  hasOpenRequest?: boolean;
}): StockStatus {
  if (product.hasOpenMalfunction && product.quantity <= 1) {
    return "malfunction";
  }
  if (product.quantity <= 0 || product.hasOpenRequest) {
    return "out_of_stock";
  }

  const minStock = product.minStock ?? 0;
  if (minStock > 0 && product.availableQuantity <= minStock) {
    return "attention";
  }
  if (product.availableQuantity <= 0) {
    return "attention";
  }
  return "in_stock";
}

export function formatAvailableLabel(availableQuantity: number) {
  if (availableQuantity <= 0) return "Nenhum produto disponível";
  if (availableQuantity === 1) return "1 disponível";
  return `${availableQuantity} disponíveis`;
}

/** Exibição de vínculo/disponibilidade na listagem. */
export function formatStockCounts(product: {
  assignedQuantity: number;
  quantity: number;
  availableQuantity: number;
  minStock?: number;
  hasOpenMalfunction?: boolean;
  hasOpenRequest?: boolean;
}) {
  const status = getStockStatus(product);
  if (status === "malfunction") {
    return {
      ratio: "1/1",
      detail: "indisponível",
    };
  }

  return {
    ratio: `${product.assignedQuantity} / ${product.quantity}`,
    detail:
      status === "out_of_stock" && product.hasOpenRequest && product.quantity > 0
        ? "pedido em aberto"
        : formatAvailableLabel(product.availableQuantity),
  };
}

/** Estoque baixo: disponíveis ≤ mínimo (quando mínimo > 0). */
export function isLowAvailableStock(product: {
  availableQuantity: number;
  minStock: number;
}) {
  return product.minStock > 0 && product.availableQuantity <= product.minStock;
}
