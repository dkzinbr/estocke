"use client";

import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { ConfirmPhraseModal } from "@/components/confirm-phrase-modal";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { RefreshButton } from "@/components/refresh-button";
import { apiFetch, jsonBody } from "@/lib/client/api";
import { getSession } from "@/lib/client/session";
import { Plus, Trash2, Users } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Department = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  _count?: { users: number; employees: number };
};

type DepartmentMember = {
  id: string;
  name: string;
  email: string;
  contactEmail: string | null;
  phone: string | null;
  active: boolean;
  userId: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    active: boolean;
    role: string;
  } | null;
};

type DepartmentDetail = Department & {
  employees: DepartmentMember[];
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
  const [deactivateTarget, setDeactivateTarget] = useState<Department | null>(
    null,
  );
  const [toggling, setToggling] = useState(false);
  const [detail, setDetail] = useState<DepartmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [memberTargets, setMemberTargets] = useState<Record<string, string>>(
    {},
  );
  const [savingMembers, setSavingMembers] = useState(false);

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

  const otherDepartments = useMemo(
    () =>
      items.filter(
        (item) => item.id !== detail?.id && item.active,
      ),
    [items, detail?.id],
  );

  function openCreate() {
    setName("");
    setModalOpen(true);
  }

  async function openDetail(item: Department) {
    setDetailLoading(true);
    setDetail(null);
    setMemberTargets({});
    try {
      const data = await apiFetch<DepartmentDetail>(
        `/api/departments/${item.id}`,
      );
      setDetail(data);
      const targets: Record<string, string> = {};
      for (const member of data.employees) {
        targets[member.id] = data.id;
      }
      setMemberTargets(targets);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao carregar departamento.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    if (savingMembers) return;
    setDetail(null);
    setMemberTargets({});
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

  function requestToggleActive(item: Department) {
    if (item.active) {
      setDeactivateTarget(item);
      return;
    }
    void activateDepartment(item);
  }

  async function activateDepartment(item: Department) {
    setToggling(true);
    try {
      await apiFetch(`/api/departments/${item.id}`, {
        method: "PATCH",
        body: jsonBody({ active: true }),
      });
      toast.success(
        "Departamento ativado. Usuários e funcionários do setor foram reativados.",
      );
      await loadItems();
      if (detail?.id === item.id) {
        await openDetail(item);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao ativar.",
      );
    } finally {
      setToggling(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setToggling(true);
    try {
      await apiFetch(`/api/departments/${deactivateTarget.id}`, {
        method: "PATCH",
        body: jsonBody({ active: false }),
      });
      toast.success(
        "Departamento desativado. Usuários do setor não poderão mais entrar até a reativação.",
      );
      setDeactivateTarget(null);
      await loadItems();
      if (detail?.id === deactivateTarget.id) {
        closeDetail();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao desativar.",
      );
    } finally {
      setToggling(false);
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

  async function saveMemberMoves() {
    if (!detail) return;

    const moves = detail.employees
      .map((member) => {
        const nextId = memberTargets[member.id] ?? detail.id;
        if (nextId === detail.id) return null;
        return {
          employeeId: member.id,
          departmentId: nextId || null,
        };
      })
      .filter((item): item is { employeeId: string; departmentId: string } =>
        !!item && !!item.departmentId,
      );

    if (!moves.length) {
      toast.message("Nenhuma transferência para salvar.");
      return;
    }

    setSavingMembers(true);
    try {
      const updated = await apiFetch<DepartmentDetail>(
        `/api/departments/${detail.id}`,
        {
          method: "PATCH",
          body: jsonBody({ moveMembers: moves }),
        },
      );
      toast.success(
        moves.length === 1
          ? "1 pessoa transferida."
          : `${moves.length} pessoas transferidas.`,
      );
      setDetail(updated);
      const targets: Record<string, string> = {};
      for (const member of updated.employees) {
        targets[member.id] = updated.id;
      }
      setMemberTargets(targets);
      await loadItems();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao transferir pessoas.",
      );
    } finally {
      setSavingMembers(false);
    }
  }

  const pendingMoves = detail
    ? detail.employees.filter(
        (member) => (memberTargets[member.id] ?? detail.id) !== detail.id,
      ).length
    : 0;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="adc-eyebrow">Organização</p>
          <h1 className="text-2xl font-semibold text-adc-navy sm:text-3xl">
            Departamentos
          </h1>
          <p className="mt-2 text-sm text-adc-muted">
            Cadastre departamentos, mova pessoas entre setores e controle o
            acesso ao desativar.
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
                  <tr key={item.id} className="hover:bg-background/40">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void openDetail(item)}
                        className="text-left font-medium text-adc-navy hover:text-adc-blue hover:underline"
                      >
                        {item.name}
                      </button>
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
                          onClick={() => void openDetail(item)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-adc-border px-3 py-1.5 text-sm font-semibold text-adc-navy"
                        >
                          <Users size={14} />
                          Pessoas
                        </button>
                        <button
                          type="button"
                          onClick={() => requestToggleActive(item)}
                          disabled={toggling}
                          className="rounded-xl border border-adc-border px-3 py-1.5 text-sm font-semibold text-adc-navy disabled:opacity-60"
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
          <Field label="Nome" required>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input"
              required
              minLength={2}
              placeholder="Ex.: TI, Financeiro, Operações"
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
              {saving ? "Salvando..." : "Criar"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!detail || detailLoading}
        title={
          detail
            ? `Departamento · ${detail.name}`
            : "Carregando departamento..."
        }
        onClose={closeDetail}
      >
        {detailLoading || !detail ? (
          <p className="text-sm text-adc-muted">Carregando pessoas...</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-adc-muted">
              {detail.active ? "Ativo" : "Inativo"} ·{" "}
              {detail.employees.length}{" "}
              {detail.employees.length === 1 ? "pessoa" : "pessoas"} neste
              setor. Transfira para outro departamento ativo e salve.
            </p>

            {detail.employees.length ? (
              <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                {detail.employees.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-xl border border-adc-border bg-background/60 px-3 py-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-adc-navy">
                          {member.name}
                        </p>
                        <p className="truncate text-xs text-adc-muted">
                          {member.email}
                          {member.active ? "" : " · inativo"}
                        </p>
                      </div>
                      <label className="block w-full sm:w-56">
                        <span className="text-xs font-medium text-adc-navy">
                          Mover para
                        </span>
                        <select
                          value={memberTargets[member.id] ?? detail.id}
                          onChange={(event) =>
                            setMemberTargets((current) => ({
                              ...current,
                              [member.id]: event.target.value,
                            }))
                          }
                          className="input mt-1"
                          disabled={savingMembers || !detail.active}
                        >
                          <option value={detail.id}>
                            Permanecer em {detail.name}
                          </option>
                          {otherDepartments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-adc-muted">
                Nenhuma pessoa vinculada a este departamento.
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDetail}
                disabled={savingMembers}
                className="rounded-xl border border-adc-border px-4 py-2 text-sm font-semibold text-adc-navy disabled:opacity-60"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => void saveMemberMoves()}
                disabled={
                  savingMembers || !pendingMoves || !detail.active
                }
                className="btn-primary disabled:opacity-60"
              >
                {savingMembers
                  ? "Salvando..."
                  : pendingMoves
                    ? `Salvar ${pendingMoves} transferência${pendingMoves > 1 ? "s" : ""}`
                    : "Salvar transferências"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmPhraseModal
        open={!!deactivateTarget}
        title="Desativar departamento"
        phrase="desativar"
        confirmLabel="Desativar departamento"
        confirming={toggling}
        description={`Desativar "${deactivateTarget?.name}" também desativa todos os usuários e funcionários deste setor. Eles não poderão entrar na plataforma até o departamento ser reativado.`}
        onCancel={() => {
          if (!toggling) setDeactivateTarget(null);
        }}
        onConfirm={() => void confirmDeactivate()}
      />

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
