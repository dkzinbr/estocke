"use client";

import { Modal } from "@/components/modal";
import { Field } from "@/components/field";
import { RefreshButton } from "@/components/refresh-button";
import { apiFetch, jsonBody } from "@/lib/client/api";
import { getSession } from "@/lib/client/session";
import {
  getStockStatus,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_TONES,
  type StockStatus,
} from "@/lib/product-status";
import { canRequestProduct } from "@/lib/product-request-rules";
import { canActForOthers, isAdminRole } from "@/lib/roles";
import { CheckCircle2, Loader2, Plus, XCircle } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type EmployeeOption = {
  id: string;
  name: string;
  email: string;
  department?: { id: string; name: string } | null;
};

type ProductOption = {
  id: string;
  name: string;
  code: string;
  quantity: number;
  availableQuantity: number;
  hasOpenMalfunction?: boolean;
  hasOpenRequest?: boolean;
  stockStatus?: StockStatus;
};

type ProductRequest = {
  id: string;
  status: "OPEN" | "FULFILLED" | "CANCELLED";
  note: string | null;
  createdAt: string;
  employee: EmployeeOption;
  product: ProductOption & { stockStatus: StockStatus };
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actingStatus, setActingStatus] = useState<
    "FULFILLED" | "CANCELLED" | null
  >(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [productId, setProductId] = useState("");
  const [note, setNote] = useState("");
  // O layout só monta as páginas no cliente, depois de carregar a sessão.
  const [isAdmin] = useState(() => isAdminRole(getSession()?.user.role));
  const [canPickEmployee] = useState(() => canActForOthers(getSession()?.user.role));
  const [selfEmployeeId, setSelfEmployeeId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ProductRequest[]>("/api/requests", {
        query: {
          search: search || undefined,
          status: "OPEN",
        },
      });
      setRequests(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao listar pedidos.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadOptions = useCallback(async () => {
    try {
      const session = getSession();
      const [employeeData, productData] = await Promise.all([
        apiFetch<EmployeeOption[]>("/api/employees", {
          query: { active: true },
        }),
        apiFetch<ProductOption[]>("/api/products"),
      ]);
      setEmployees(employeeData);

      const self = employeeData.find(
        (employee) => employee.email === session?.user.email,
      );
      setSelfEmployeeId(self?.id ?? employeeData[0]?.id ?? null);

      setProducts(
        productData.map((product) => ({
          ...product,
          stockStatus: getStockStatus({
            quantity: product.quantity,
            availableQuantity: product.availableQuantity,
            hasOpenMalfunction: product.hasOpenMalfunction,
            hasOpenRequest: product.hasOpenRequest,
          }),
        })),
      );
    } catch {
      // keep empty
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void Promise.all([loadRequests(), loadOptions()]);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadOptions, loadRequests]);

  const selectedProduct = products.find((product) => product.id === productId);
  const selectedCanRequest = selectedProduct
    ? canRequestProduct({
        quantity: selectedProduct.quantity,
        availableQuantity: selectedProduct.availableQuantity,
        hasOpenMalfunction: !!selectedProduct.hasOpenMalfunction,
      })
    : false;

  function openCreate() {
    const defaultEmployee = canPickEmployee
      ? (employees[0]?.id ?? "")
      : (selfEmployeeId ?? employees[0]?.id ?? "");
    const firstAllowed =
      products.find((product) =>
        canRequestProduct({
          quantity: product.quantity,
          availableQuantity: product.availableQuantity,
          hasOpenMalfunction: !!product.hasOpenMalfunction,
        }),
      )?.id ?? "";
    setEmployeeId(defaultEmployee);
    setProductId(firstAllowed);
    setNote("");
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      selectedProduct &&
      !canRequestProduct({
        quantity: selectedProduct.quantity,
        availableQuantity: selectedProduct.availableQuantity,
        hasOpenMalfunction: !!selectedProduct.hasOpenMalfunction,
      })
    ) {
      toast.error(
        "Item único em mal funcionamento. Não é possível pedir.",
      );
      return;
    }

    setSaving(true);

    try {
      await apiFetch<ProductRequest>("/api/requests", {
        method: "POST",
        body: jsonBody({
          employeeId,
          productId,
          note: note || null,
        }),
      });

      toast.success("Pedido criado.");
      setModalOpen(false);

      await loadRequests();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar pedido.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(
    item: ProductRequest,
    status: "FULFILLED" | "CANCELLED",
  ) {
    if (actingId) return;
    setActingId(item.id);
    setActingStatus(status);
    try {
      await apiFetch(`/api/requests/${item.id}`, {
        method: "PATCH",
        body: jsonBody({ status }),
      });
      toast.success(
        status === "FULFILLED"
          ? "Pedido atendido. Produto vinculado ao funcionário."
          : "Pedido cancelado.",
      );
      await loadRequests();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar pedido.",
      );
    } finally {
      setActingId(null);
      setActingStatus(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="adc-eyebrow">Requisições</p>
          <h1 className="text-2xl font-semibold text-adc-navy sm:text-3xl">
            Pedidos
          </h1>
          <p className="mt-2 text-sm text-adc-muted">
            {canPickEmployee
              ? "Administradores podem pedir para qualquer pessoa. Ao atender, o produto entra na listagem do funcionário."
              : "Você só pode criar pedidos para si. Aqui ficam apenas os pedidos em aberto."}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          disabled={!employees.length || !products.length}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-60 sm:w-auto"
        >
          <Plus size={16} />
          Novo pedido
        </button>
      </section>

      <section className="adc-panel overflow-hidden">
        <div className="border-b border-adc-border bg-background/50 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadRequests();
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar funcionário, e-mail, departamento ou produto"
              className="input w-full sm:flex-1"
            />
            <button className="btn-primary w-full sm:w-auto">Buscar</button>
            <RefreshButton
              onClick={() => void loadRequests()}
              loading={loading}
            />
          </form>
        </div>

        <div className="table-wrap">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-adc-border bg-background/70 text-xs uppercase tracking-wide text-adc-muted">
              <tr>
                <th className="px-4 py-3">Funcionário</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Departamento</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Situação</th>
                {isAdmin ? (
                  <th className="px-4 py-3 text-right">Ações</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-adc-border/70">
              {loading ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 5}
                    className="px-4 py-8 text-center text-adc-muted"
                  >
                    Carregando pedidos...
                  </td>
                </tr>
              ) : requests.length ? (
                requests.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-adc-navy">
                      {item.employee.name}
                    </td>
                    <td className="px-4 py-3 text-adc-muted">
                      {item.employee.email}
                    </td>
                    <td className="px-4 py-3 text-adc-muted">
                      {item.employee.department?.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-adc-navy">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-adc-muted">
                        {item.product.code}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${STOCK_STATUS_TONES[item.product.stockStatus]}`}
                      >
                        {STOCK_STATUS_LABELS[item.product.stockStatus]}
                      </span>
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void updateStatus(item, "FULFILLED")}
                            disabled={!!actingId}
                            className="rounded-lg border border-adc-border p-2 text-emerald-700 hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Atender pedido"
                            title="Atender"
                          >
                            {actingId === item.id &&
                            actingStatus === "FULFILLED" ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={16} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateStatus(item, "CANCELLED")}
                            disabled={!!actingId}
                            className="rounded-lg border border-adc-border p-2 text-adc-muted hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Cancelar pedido"
                            title="Cancelar"
                          >
                            {actingId === item.id &&
                            actingStatus === "CANCELLED" ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <XCircle size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 5}
                    className="px-4 py-8 text-center text-adc-muted"
                  >
                    Nenhum pedido nesta aba.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title="Novo pedido"
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Funcionário" required={canPickEmployee}>
            {canPickEmployee ? (
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="input"
                required
              >
                <option value="">Selecione</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                    {employee.department?.name
                      ? ` · ${employee.department.name}`
                      : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                value={
                  employees.find((employee) => employee.id === employeeId)
                    ?.name ?? "Você"
                }
                disabled
                readOnly
              />
            )}
          </Field>

          <Field label="Produto" required>
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="input"
              required
            >
              <option value="">Selecione</option>
              {products.map((product) => {
                const allowed = canRequestProduct({
                  quantity: product.quantity,
                  availableQuantity: product.availableQuantity,
                  hasOpenMalfunction: !!product.hasOpenMalfunction,
                });
                return (
                  <option
                    key={product.id}
                    value={product.id}
                    disabled={!allowed}
                  >
                    {product.name} ({product.code})
                    {!allowed ? " · bloqueado (único + mal funcionamento)" : ""}
                  </option>
                );
              })}
            </select>
          </Field>

          {selectedProduct && !selectedCanRequest ? (
            <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-sm text-amber-800">
              Este produto é item único e está em mal funcionamento. Não é
              possível criar pedido.
            </p>
          ) : null}

          {selectedProduct && selectedCanRequest ? (
            <p
              className={`rounded-xl px-3 py-2 text-sm ${
                selectedProduct.stockStatus === "in_stock"
                  ? "bg-emerald-500/10 text-emerald-800"
                  : selectedProduct.stockStatus === "attention"
                    ? "bg-amber-400/15 text-amber-800"
                    : selectedProduct.stockStatus === "malfunction"
                      ? "bg-orange-500/15 text-orange-800"
                      : "bg-adc-danger-bg text-adc-danger-text"
              }`}
            >
              Situação atual:{" "}
              <strong>
                {selectedProduct.stockStatus
                  ? STOCK_STATUS_LABELS[selectedProduct.stockStatus]
                  : "—"}
              </strong>
            </p>
          ) : null}

          <Field label="Observação">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="input min-h-20"
              placeholder="Motivo ou detalhe do pedido"
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
              disabled={saving || !selectedCanRequest}
              className="btn-primary disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Criar pedido"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
