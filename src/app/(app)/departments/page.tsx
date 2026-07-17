"use client";

import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { Modal } from "@/components/modal";
import { RefreshButton } from "@/components/refresh-button";
import { apiFetch, jsonBody } from "@/lib/client/api";
import { getSession } from "@/lib/client/session";
import { Plus, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Department = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  _count?: { users: number; employees: number };
};

export default function DepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Department[]>("/api/departments", {
        query: { all: true, active: "all", search: search || undefined },
      });
      setItems(data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao listar departamentos.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (getSession()?.user.role !== "ADMIN") {
      window.location.replace("/dashboard");
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadItems();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadItems]);

  function openCreate() {
    setName("");
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/departments", {
        method: "POST",
        body: jsonBody({ name }),
      });
      toast.success("Departamento criado.");
      setModalOpen(false);
      await loadItems();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar departamento.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: Department) {
    try {
      await apiFetch(`/api/departments/${item.id}`, {
        method: "PATCH",
        body: jsonBody({ active: !item.active }),
      });
      toast.success(item.active ? "Departamento desativado." : "Departamento ativado.");
      await loadItems();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar.",
      );
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/departments/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success("Departamento excluído.");
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
          <p className="adc-eyebrow">Organização</p>
          <h1 className="text-2xl font-semibold text-adc-navy sm:text-3xl">
            Departamentos
          </h1>
          <p className="mt-2 text-sm text-adc-muted">
            Cadastre departamentos para vincular nas contas e nos funcionários.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto"
        >
          <Plus size={16} />
          Novo departamento
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
              placeholder="Buscar departamento"
              className="input w-full sm:flex-1"
            />
            <button className="btn-primary w-full sm:w-auto">Buscar</button>
            <RefreshButton onClick={() => void loadItems()} loading={loading} />
          </form>
        </div>

        <div className="table-wrap">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-adc-border bg-background/70 text-xs uppercase tracking-wide text-adc-muted">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Vínculos</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-adc-border/70">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-adc-muted"
                  >
                    Carregando...
                  </td>
                </tr>
              ) : items.length ? (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-adc-navy">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-adc-muted">
                      {item._count
                        ? `${item._count.users} usuários · ${item._count.employees} funcionários`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.active ? "Ativo" : "Inativo"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleActive(item)}
                          className="rounded-xl border border-adc-border px-3 py-1.5 text-sm font-semibold text-adc-navy"
                        >
                          {item.active ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="rounded-lg border border-adc-border p-2 text-red-600 hover:bg-adc-danger-bg"
                          aria-label="Excluir departamento"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-adc-muted"
                  >
                    Nenhum departamento cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title="Novo departamento"
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-adc-navy">Nome</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input mt-1"
              required
              minLength={2}
              placeholder="Ex.: TI, Financeiro, Operações"
            />
          </label>

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
              {saving ? "Salvando..." : "Criar"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        description={`Excluir o departamento "${deleteTarget?.name}"?`}
        confirming={deleting}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
