export type StockStatus =
  | "in_stock"
  | "attention"
  | "out_of_stock"
  | "malfunction";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: "Em estoque",
  attention: "Sem estoque",
  out_of_stock: "Pedido aberto",
  malfunction: "Mal funcionamento",
};

export const STOCK_STATUS_TONES: Record<StockStatus, string> = {
  in_stock: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  attention: "bg-amber-400/20 text-amber-700 dark:text-amber-300",
  out_of_stock: "bg-adc-danger-bg text-adc-danger-text",
  malfunction: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
};

/**
 * Status do produto:
 * - Mal funcionamento: mal funcionamento aberto e estoque total ≤ 1
 * - Pedido aberto: estoque zerado OU pedido aberto (demanda em aberto)
 * - Em estoque / Sem estoque: conforme disponibilidade
 */
export function getStockStatus(product: {
  quantity: number;
  availableQuantity: number;
  hasOpenMalfunction?: boolean;
  hasOpenRequest?: boolean;
}): StockStatus {
  if (product.hasOpenMalfunction && product.quantity <= 1) {
    return "malfunction";
  }
  if (product.quantity <= 0 || product.hasOpenRequest) {
    return "out_of_stock";
  }

  const half = product.quantity / 2;
  if (product.availableQuantity > half) return "in_stock";
  return "attention";
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
