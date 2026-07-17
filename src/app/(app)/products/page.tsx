"use client";

import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { Modal } from "@/components/modal";
import { RefreshButton } from "@/components/refresh-button";
import { apiFetch, jsonBody } from "@/lib/client/api";
import { getSession } from "@/lib/client/session";
import {
  formatStockCounts,
  getStockStatus,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_TONES,
  type StockStatus,
} from "@/lib/product-status";
import { isAdminRole } from "@/lib/roles";
import { Edit2, PackagePlus, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Product = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  quantity: number;
  minStock: number;
  active: boolean;
  assignedQuantity: number;
  availableQuantity: number;
  hasOpenMalfunction?: boolean;
  hasOpenRequest?: boolean;
};

type ProductForm = {
  id?: string;
  name: string;
  code: string;
  description: string;
  quantity: string;
  minStock: string;
};

type StockFilter = "all" | StockStatus;

const emptyForm: ProductForm = {
  name: "",
  code: "",
  description: "",
  quantity: "0",
  minStock: "0",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(isAdminRole(getSession()?.user.role));
  }, []);

  const loadProducts = useCallback(async (nextSearch = search) => {
    setLoading(true);

    try {
      const data = await apiFetch<Product[]>("/api/products", {
        query: {
          search: nextSearch,
        },
      });
      setProducts(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao listar produtos.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadProducts();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    if (stockFilter === "all") return products;
    return products.filter(
      (product) => getStockStatus(product) === stockFilter,
    );
  }, [products, stockFilter]);

  function openCreate() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setForm({
      id: product.id,
      name: product.name,
      code: product.code,
      description: product.description ?? "",
      quantity: String(product.quantity),
      minStock: String(product.minStock),
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const payload = {
      name: form.name,
      code: form.code,
      description: form.description || null,
      quantity: Number(form.quantity),
      minStock: Number(form.minStock),
      active: true,
    };

    try {
      await apiFetch<Product>(
        form.id ? `/api/products/${form.id}` : "/api/products",
        {
          method: form.id ? "PATCH" : "POST",
          body: jsonBody(payload),
        },
      );
      toast.success(form.id ? "Produto atualizado." : "Produto criado.");
      closeModal();
      await loadProducts();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar produto.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await apiFetch<void>(`/api/products/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success("Produto excluído.");
      setDeleteTarget(null);
      await loadProducts();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao excluir produto.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const colSpan = isAdmin ? 5 : 4;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="adc-eyebrow">Estoque</p>
          <h1 className="text-2xl font-semibold text-adc-navy sm:text-3xl">
            Produtos
          </h1>
          <p className="mt-2 text-sm text-adc-muted">
            {isAdmin
              ? "Cadastre itens. Status: Em estoque, Sem estoque, Pedido aberto ou Mal funcionamento."
              : "Consulte itens. Status: Em estoque, Sem estoque, Pedido aberto ou Mal funcionamento."}
          </p>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          >
            <PackagePlus size={16} />
            Novo produto
          </button>
        ) : null}
      </section>

      <section className="adc-panel overflow-hidden">
        <div className="border-b border-adc-border bg-background/60 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadProducts();
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou código"
              className="input w-full sm:min-w-[220px] sm:flex-1"
            />
            <select
              value={stockFilter}
              onChange={(event) =>
                setStockFilter(event.target.value as StockFilter)
              }
              className="input w-full sm:w-auto"
            >
              <option value="all">Todos</option>
              <option value="in_stock">Em estoque</option>
              <option value="attention">Sem estoque</option>
              <option value="out_of_stock">Pedido aberto</option>
              <option value="malfunction">Mal funcionamento</option>
            </select>
            <button className="btn-primary w-full sm:w-auto">Buscar</button>
            <RefreshButton
              onClick={() => void loadProducts()}
              loading={loading}
            />
          </form>
        </div>

        <div className="table-wrap">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-adc-border bg-background text-xs uppercase tracking-wide text-adc-muted">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Vinculado</th>
                <th className="px-4 py-3">Status</th>
                {isAdmin ? (
                  <th className="px-4 py-3 text-right">Ações</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-adc-border/70">
              {loading ? (
                <tr>
                  <td
                    colSpan={colSpan}
                    className="px-4 py-8 text-center text-adc-muted"
                  >
                    Carregando produtos...
                  </td>
                </tr>
              ) : filteredProducts.length ? (
                filteredProducts.map((product) => {
                  const status = getStockStatus(product);
                  const counts = formatStockCounts(product);

                  return (
                    <tr key={product.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-adc-navy">{product.name}</p>
                        <p className="text-xs text-adc-muted">
                          {product.description || "Sem descrição"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-adc-muted">{product.code}</td>
                      <td className="px-4 py-3 text-adc-muted">
                        {counts.ratio}
                        <span
                          className={`block text-xs ${
                            status === "malfunction"
                              ? "font-semibold text-orange-800"
                              : ""
                          }`}
                        >
                          {counts.detail}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${STOCK_STATUS_TONES[status]}`}
                        >
                          {STOCK_STATUS_LABELS[status]}
                        </span>
                      </td>
                      {isAdmin ? (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(product)}
                              className="rounded-lg border border-adc-border p-2 text-adc-muted hover:bg-background"
                              aria-label="Editar produto"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(product)}
                              className="rounded-lg border border-adc-border p-2 text-red-600 hover:bg-adc-danger-bg"
                              aria-label="Excluir produto"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={colSpan}
                    className="px-4 py-8 text-center text-adc-muted"
                  >
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title={form.id ? "Editar produto" : "Novo produto"}
        onClose={closeModal}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nome">
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="input"
              required
            />
          </Field>
          <Field label="Código">
            <input
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              className="input"
              required
            />
          </Field>
          <Field label="Descrição">
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              className="input min-h-20"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Qtd.">
              <input
                type="number"
                min="0"
                value={form.quantity}
                onChange={(event) =>
                  setForm({ ...form, quantity: event.target.value })
                }
                className="input"
              />
            </Field>
            <Field label="Mín.">
              <input
                type="number"
                min="0"
                value={form.minStock}
                onChange={(event) =>
                  setForm({ ...form, minStock: event.target.value })
                }
                className="input"
              />
            </Field>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-xl border border-adc-border px-4 py-2 text-sm font-semibold text-adc-navy"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        description={`Tem certeza que deseja excluir o produto "${deleteTarget?.name}"? Essa ação não pode ser desfeita.`}
        confirming={deleting}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-adc-navy">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
