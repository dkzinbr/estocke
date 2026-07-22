"use client";

import { ConfirmPhraseModal } from "@/components/confirm-phrase-modal";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { RefreshButton } from "@/components/refresh-button";
import { apiFetch, jsonBody } from "@/lib/client/api";
import { clearSession, getSession } from "@/lib/client/session";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { MoreHorizontal, Shield, UserCog, UserX } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  active: boolean;
  createdAt: string;
  department?: { id: string; name: string } | null;
};

const ROLE_BADGE: Record<AppRole, string> = {
  ADMIN: "bg-adc-blue/10 text-adc-blue",
  SUPERVISOR: "bg-amber-400/20 text-amber-800",
  EMPLOYEE: "bg-adc-mint/10 text-adc-navy",
};

const ROLE_OPTIONS: AppRole[] = ["ADMIN", "SUPERVISOR", "EMPLOYEE"];

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<AppUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("EMPLOYEE");
  const [savingRole, setSavingRole] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<AppUser | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const currentUserId = getSession()?.user.id;

  const loadUsers = useCallback(
    async (nextSearch = search) => {
      setLoading(true);

      try {
        const data = await apiFetch<AppUser[]>("/api/users", {
          query: { search: nextSearch },
        });
        setUsers(data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Erro ao listar usuários.",
        );
      } finally {
        setLoading(false);
      }
    },
    [search],
  );

  useEffect(() => {
    const session = getSession();
    if (session?.user.role !== "ADMIN") {
      window.location.replace("/dashboard");
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadUsers]);

  useEffect(() => {
    if (!menuUserId) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      const el = target instanceof Element ? target : target.parentElement;
      if (el?.closest("[data-user-actions]")) return;
      setMenuUserId(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [menuUserId]);

  async function applyUserPatch(
    user: AppUser,
    patch: { role?: AppRole; active?: boolean },
    successMessage: string,
  ) {
    setUpdatingId(user.id);

    try {
      const updated = await apiFetch<
        AppUser & { sessionInvalidated?: boolean }
      >(`/api/users/${user.id}`, {
        method: "PATCH",
        body: jsonBody(patch),
      });

      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      );
      toast.success(successMessage);

      if (updated.sessionInvalidated) {
        toast.message("Seu cargo mudou. Faça login novamente.");
        clearSession();
        window.location.replace("/login");
      }

      return updated;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar usuário.",
      );
      throw error;
    } finally {
      setUpdatingId(null);
    }
  }

  function openRoleModal(user: AppUser) {
    setMenuUserId(null);
    setRoleTarget(user);
    setSelectedRole(user.role);
  }

  function openDeactivateModal(user: AppUser) {
    setMenuUserId(null);
    setDeactivateTarget(user);
  }

  async function handleRoleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roleTarget) return;
    if (selectedRole === roleTarget.role) {
      setRoleTarget(null);
      return;
    }

    setSavingRole(true);
    try {
      await applyUserPatch(
        roleTarget,
        { role: selectedRole },
        `Cargo atualizado para ${ROLE_LABELS[selectedRole]}.`,
      );
      setRoleTarget(null);
    } catch {
      // toast already shown
    } finally {
      setSavingRole(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await applyUserPatch(
        deactivateTarget,
        { active: false },
        "Usuário desativado. O acesso à plataforma foi bloqueado.",
      );
      setDeactivateTarget(null);
    } catch {
      // toast already shown
    } finally {
      setDeactivating(false);
    }
  }

  async function activateUser(user: AppUser) {
    setMenuUserId(null);
    try {
      await applyUserPatch(
        user,
        { active: true },
        "Usuário reativado. O acesso à plataforma foi liberado.",
      );
    } catch {
      // toast already shown
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="adc-eyebrow">Administração</p>
          <h1 className="text-2xl font-semibold text-adc-navy sm:text-3xl">
            Usuários
          </h1>
          <p className="mt-2 text-sm text-adc-muted">
            Administrador: acesso total. Supervisão: vê pedidos e mal
            funcionamentos gerais, mas só age em nome próprio. Funcionário: vê e
            age apenas no próprio perfil.
          </p>
        </div>
      </section>

      <section className="adc-panel overflow-hidden">
        <div className="border-b border-adc-border bg-background/60 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadUsers();
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar nome ou e-mail"
              className="input w-full sm:min-w-[220px] sm:flex-1"
            />
            <button className="btn-primary w-full sm:w-auto">Buscar</button>
            <RefreshButton onClick={() => void loadUsers()} loading={loading} />
          </form>
        </div>

        <div className="table-wrap">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-adc-border bg-background text-xs uppercase tracking-wide text-adc-muted">
              <tr>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Cargo</th>
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
                    Carregando usuários...
                  </td>
                </tr>
              ) : users.length ? (
                users.map((user) => {
                  const busy = updatingId === user.id;
                  const menuOpen = menuUserId === user.id;

                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-adc-navy">
                          {user.name}
                          {user.id === currentUserId ? (
                            <span className="ml-2 text-xs font-normal text-adc-muted">
                              (você)
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-adc-muted">{user.email}</p>
                        <p className="text-xs text-adc-muted">
                          {user.department?.name ?? "Sem departamento"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${ROLE_BADGE[user.role]}`}
                        >
                          {user.role === "ADMIN" ? <Shield size={12} /> : null}
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.active ? "Ativo" : "Inativo"}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="relative flex justify-end"
                          data-user-actions
                        >
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setMenuUserId((current) =>
                                current === user.id ? null : user.id,
                              )
                            }
                            className="inline-flex size-9 items-center justify-center rounded-xl border border-adc-border text-adc-navy transition hover:bg-background disabled:opacity-60"
                            aria-label={`Ações de ${user.name}`}
                            aria-expanded={menuOpen}
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          {menuOpen ? (
                            <div className="absolute right-0 top-[calc(100%+0.35rem)] z-20 w-48 overflow-hidden rounded-xl border border-adc-border bg-adc-surface py-1 shadow-lg">
                              <button
                                type="button"
                                onClick={() => openRoleModal(user)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-adc-navy transition hover:bg-background"
                              >
                                <UserCog size={14} />
                                Definir cargo
                              </button>
                              {user.active ? (
                                <button
                                  type="button"
                                  onClick={() => openDeactivateModal(user)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-adc-danger-bg"
                                >
                                  <UserX size={14} />
                                  Desativar usuário
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void activateUser(user)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-adc-navy transition hover:bg-background"
                                >
                                  <UserCog size={14} />
                                  Ativar usuário
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-adc-muted"
                  >
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={!!roleTarget}
        title="Definir cargo"
        onClose={() => {
          if (!savingRole) setRoleTarget(null);
        }}
      >
        <form onSubmit={handleRoleSubmit} className="space-y-4">
          <p className="text-sm text-adc-muted">
            Defina o cargo de{" "}
            <span className="font-medium text-adc-navy">
              {roleTarget?.name}
            </span>
            .
          </p>

          <Field label="Cargo" required>
            <select
              value={selectedRole}
              onChange={(event) =>
                setSelectedRole(event.target.value as AppRole)
              }
              className="input"
              disabled={savingRole}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setRoleTarget(null)}
              disabled={savingRole}
              className="rounded-xl border border-adc-border px-4 py-2 text-sm font-semibold text-adc-navy disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingRole}
              className="btn-primary disabled:opacity-60"
            >
              {savingRole ? "Salvando..." : "Salvar cargo"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmPhraseModal
        open={!!deactivateTarget}
        title="Desativar usuário"
        phrase="desativar"
        confirmLabel="Desativar usuário"
        confirming={deactivating}
        description={`Desativar "${deactivateTarget?.name}" bloqueia o login na plataforma. O funcionário vinculado também será desativado.`}
        onCancel={() => {
          if (!deactivating) setDeactivateTarget(null);
        }}
        onConfirm={() => void confirmDeactivate()}
      />
    </div>
  );
}
