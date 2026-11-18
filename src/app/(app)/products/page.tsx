"use client";

import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { Field } from "@/components/field";
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
import { Edit2, Link2, PackagePlus, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ProductLink = {
  id: string;
  parentId: string;
  childId: string;
  quantity: number;
  note: string | null;
  child: {
    id: string;
    name: string;
    code: string;
    quantity: number;
    active: boolean;
  };
};

type Product = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  quantity: number;
  minStock: number;
  active: boolean;
  assignedQuantity: number;
  linkedQuantity?: number;
  availableQuantity: number;
  hasOpenMalfunction?: boolean;
  hasOpenRequest?: boolean;
  childLinks?: ProductLink[];
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
  const [childLinks, setChildLinks] = useState<ProductLink[]>([]);
  const [linkChildId, setLinkChildId] = useState("");
  const [linkQuantity, setLinkQuantity] = useState("1");
  const [linkNote, setLinkNote] = useState("");
  const [linking, setLinking] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  // O layout só monta as páginas no cliente, depois de carregar a sessão.
  const [isAdmin] = useState(() => isAdminRole(getSession()?.user.role));

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

  const linkableChildren = useMemo(() => {
    if (!form.id) return [];
    const linkedIds = new Set(childLinks.map((link) => link.childId));
    return products.filter(
      (product) =>
        product.id !== form.id &&
        product.active !== false &&
        !linkedIds.has(product.id),
    );
  }, [childLinks, form.id, products]);

  async function loadLinks(productId: string) {
    try {
      const links = await apiFetch<ProductLink[]>(
        `/api/products/${productId}/links`,
      );
      setChildLinks(links);
    } catch {
      setChildLinks([]);
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setChildLinks([]);
    setLinkChildId("");
    setLinkQuantity("1");
    setLinkNote("");
    setModalOpen(true);
  }

  async function openEdit(product: Product) {
    setForm({
      id: product.id,
      name: product.name,
      code: product.code,
      description: product.description ?? "",
      quantity: String(product.quantity),
      minStock: String(product.minStock),
    });
    setLinkChildId("");
    setLinkQuantity("1");
    setLinkNote("");
    setModalOpen(true);
    await loadLinks(product.id);
  }

  function closeModal() {
    setModalOpen(false);
    setForm(emptyForm);
    setChildLinks([]);
    setLinkChildId("");
    setLinkQuantity("1");
    setLinkNote("");
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

  async function handleAddLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.id || !linkChildId) return;
    setLinking(true);

    try {
      await apiFetch(`/api/products/${form.id}/links`, {
        method: "POST",
        body: jsonBody({
          childId: linkChildId,
          quantity: Number(linkQuantity),
          note: linkNote || null,
        }),
      });
      toast.success("Componente vinculado.");
      setLinkChildId("");
      setLinkQuantity("1");
      setLinkNote("");
      await Promise.all([loadLinks(form.id), loadProducts()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao vincular componente.",
      );
    } finally {
      setLinking(false);
    }
  }

  async function removeLink(linkId: string) {
    if (!form.id) return;
    try {
      await apiFetch(`/api/products/${form.id}/links/${linkId}`, {
        method: "DELETE",
      });
      toast.success("Componente desvinculado.");
      await Promise.all([loadLinks(form.id), loadProducts()]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao desvincular componente.",
      );
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
                              onClick={() => void openEdit(product)}
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
          <Field label="Nome" required>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="input"
              required
            />
          </Field>
          <Field label="Código" required>
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
            <Field
              label="Mínimo disponível"
              hint="Conta unidades ainda disponíveis (não atribuídas a funcionários nem vinculadas como componente)."
            >
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
              {form.id ? "Fechar" : "Cancelar"}
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

        {isAdmin && form.id ? (
          <div className="mt-6 space-y-4 border-t border-adc-border pt-5">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-adc-navy">
                <Link2 size={16} />
                Componentes vinculados
              </p>
              <p className="mt-1 text-xs text-adc-muted">
                Vincule produtos-filhos usados neste item. A quantidade reduz o
                disponível do componente.
              </p>
            </div>

            {childLinks.length ? (
              <ul className="space-y-2">
                {childLinks.map((link) => (
                  <li
                    key={link.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-adc-border bg-background px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-adc-navy">
                        {link.child.name} × {link.quantity}
                      </p>
                      <p className="text-xs text-adc-muted">
                        {link.child.code}
                        {link.note ? ` · ${link.note}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeLink(link.id)}
                      className="rounded-lg border border-adc-border p-2 text-red-600 hover:bg-adc-danger-bg"
                      aria-label={`Remover ${link.child.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-adc-muted">
                Nenhum componente vinculado.
              </p>
            )}

            <form onSubmit={handleAddLink} className="space-y-3">
              <Field label="Componente" required>
                <select
                  value={linkChildId}
                  onChange={(event) => setLinkChildId(event.target.value)}
                  className="input"
                  required
                >
                  <option value="">Selecione</option>
                  {linkableChildren.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.code}) · disp.{" "}
                      {product.availableQuantity}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Quantidade" required>
                  <input
                    type="number"
                    min="1"
                    value={linkQuantity}
                    onChange={(event) => setLinkQuantity(event.target.value)}
                    className="input"
                    required
                  />
                </Field>
                <Field label="Observação">
                  <input
                    value={linkNote}
                    onChange={(event) => setLinkNote(event.target.value)}
                    className="input"
                    placeholder="Opcional"
                  />
                </Field>
              </div>
              <button
                type="submit"
                disabled={linking || !linkChildId}
                className="btn-primary w-full disabled:opacity-60 sm:w-auto"
              >
                {linking ? "Vinculando..." : "Vincular componente"}
              </button>
            </form>
          </div>
        ) : null}
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
