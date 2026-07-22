"use client";

import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { RefreshButton } from "@/components/refresh-button";
import { apiFetch, jsonBody } from "@/lib/client/api";
import { getSession } from "@/lib/client/session";
import { canActForOthers, isAdminRole } from "@/lib/roles";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type ProductOption = {
  id: string;
  name: string;
  code: string;
};

type EmployeeWithAssignments = {
  id: string;
  name: string;
  email: string;
  assignments: {
    product: ProductOption;
  }[];
};

type Malfunction = {
  id: string;
  description: string;
  active: boolean;
  createdAt: string;
  resolvedAt: string | null;
  product: ProductOption;
  reportedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export default function MalfunctionsPage() {
  const [items, setItems] = useState<Malfunction[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [search, setSearch] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Malfunction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canReportAny, setCanReportAny] = useState(false);

  useEffect(() => {
    const role = getSession()?.user.role;
    setIsAdmin(isAdminRole(role));
    setCanReportAny(canActForOthers(role));
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Malfunction[]>("/api/malfunctions", {
        query: {
          search: search || undefined,
          active: showResolved ? "all" : true,
        },
      });
      setItems(data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao listar mal funcionamentos.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, showResolved]);

  const loadProducts = useCallback(async () => {
    try {
      const session = getSession();
      const role = session?.user.role;

      if (canActForOthers(role)) {
        const data = await apiFetch<ProductOption[]>("/api/products");
        setProducts(data);
        return;
      }

      const employees = await apiFetch<EmployeeWithAssignments[]>(
        "/api/employees",
        { query: { active: true } },
      );
      const self =
        employees.find((employee) => employee.email === session?.user.email) ??
        employees[0];

      const assigned = (self?.assignments ?? []).map((item) => item.product);
      const unique = new Map(assigned.map((product) => [product.id, product]));
      setProducts([...unique.values()]);
    } catch {
      // keep empty
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void Promise.all([loadItems(), loadProducts()]);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadItems, loadProducts]);

  function openCreate() {
    setProductId(products[0]?.id ?? "");
    setDescription("");
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await apiFetch<Malfunction>("/api/malfunctions", {
        method: "POST",
        body: jsonBody({ productId, description }),
      });
      toast.success(
        "Mal funcionamento registrado. Produto removido da listagem dos funcionários.",
      );
      setModalOpen(false);
      await Promise.all([loadItems(), loadProducts()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao registrar.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function resolveItem(item: Malfunction) {
    if (resolvingId || deleting) return;
    setResolvingId(item.id);
    try {
      await apiFetch(`/api/malfunctions/${item.id}`, {
        method: "PATCH",
        body: jsonBody({ active: false }),
      });
      toast.success("Marcado como resolvido.");
      await loadItems();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao resolver.",
      );
    } finally {
      setResolvingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting || resolvingId) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/malfunctions/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success("Registro excluído.");
      setDeleteTarget(null);
      await loadItems();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao excluir.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="adc-eyebrow">Qualidade</p>
          <h1 className="text-2xl font-semibold text-adc-navy sm:text-3xl">
            Mal funcionamento
          </h1>
          <p className="mt-2 text-sm text-adc-muted">
            {canReportAny
              ? "Ao registrar, o produto sai da listagem de todos os funcionários vinculados."
              : "Registre problemas apenas dos produtos vinculados a você. O vínculo será removido automaticamente."}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          disabled={!products.length}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-60 sm:w-auto"
        >
          <Plus size={16} />
          Registrar problema
        </button>
      </section>

      <section className="adc-panel overflow-hidden">
        <div className="border-b border-adc-border bg-background/50 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadItems();
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar produto, código ou descrição"
              className="input w-full sm:flex-1"
            />
            <label className="flex items-center gap-2 rounded-xl border border-adc-border px-3 py-2 text-sm text-adc-navy">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(event) => setShowResolved(event.target.checked)}
              />
              Incluir resolvidos
            </label>
            <button className="btn-primary w-full sm:w-auto">Buscar</button>
            <RefreshButton onClick={() => void loadItems()} loading={loading} />
          </form>
        </div>

        <div className="divide-y divide-adc-border/70">
          {loading ? (
            <p className="px-4 py-10 text-center text-sm text-adc-muted">
              Carregando...
            </p>
          ) : items.length ? (
            items.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle
                      size={16}
                      className={
                        item.active ? "text-amber-600" : "text-adc-muted"
                      }
                    />
                    <p className="font-semibold text-adc-navy">
                      {item.product.name}
                    </p>
                    <span className="text-xs text-adc-muted">
                      {item.product.code}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.active
                          ? "bg-amber-400/20 text-amber-700"
                          : "bg-adc-mint/15 text-adc-navy"
                      }`}
                    >
                      {item.active ? "Aberto" : "Resolvido"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-adc-navy/90">
                    {item.description}
                  </p>
                  <p className="mt-2 text-xs text-adc-muted">
                    Registrado em{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(item.createdAt))}
                    {item.reportedBy
                      ? ` · por ${item.reportedBy.name}`
                      : ""}
                    {item.resolvedAt
                      ? ` · Resolvido em ${new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(item.resolvedAt))}`
                      : ""}
                  </p>
                </div>

                {isAdmin ? (
                  <div className="flex shrink-0 gap-2">
                    {item.active ? (
                      <button
                        type="button"
                        onClick={() => void resolveItem(item)}
                        disabled={!!resolvingId || deleting}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-adc-border px-3 py-2 text-sm font-semibold text-adc-navy hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resolvingId === item.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        {resolvingId === item.id ? "Resolvendo..." : "Resolver"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      disabled={!!resolvingId || deleting}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-adc-border px-3 py-2 text-sm font-semibold text-red-600 hover:bg-adc-danger-bg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deleting && deleteTarget?.id === item.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      {deleting && deleteTarget?.id === item.id
                        ? "Excluindo..."
                        : "Excluir"}
                    </button>
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <p className="px-4 py-10 text-center text-sm text-adc-muted">
              Nenhum mal funcionamento encontrado.
            </p>
          )}
        </div>
      </section>

      <Modal
        open={modalOpen}
        title="Registrar mal funcionamento"
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Produto" required>
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="input"
              required
            >
              <option value="">Selecione</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.code})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Descrição do problema" required>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="input min-h-28"
              required
              minLength={3}
              placeholder="Ex.: tela com manchas, não liga, teclado com teclas falhando..."
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-adc-border px-4 py-2 text-sm font-semibold text-adc-navy"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Registrar"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        description={`Excluir o registro de mal funcionamento de "${deleteTarget?.product.name}"?`}
        confirming={deleting}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
