"use client";

import { RefreshButton } from "@/components/refresh-button";
import { apiFetch, jsonBody } from "@/lib/client/api";
import { clearSession, getSession } from "@/lib/client/session";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { Shield } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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

  async function updateUser(
    user: AppUser,
    patch: { role?: AppRole; active?: boolean },
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
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success("Usuário atualizado.");

      if (updated.sessionInvalidated) {
        toast.message("Seu cargo mudou. Faça login novamente.");
        clearSession();
        window.location.replace("/login");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar usuário.",
      );
    } finally {
      setUpdatingId(null);
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
                        <div className="flex flex-wrap justify-end gap-2">
                          <select
                            value={user.role}
                            disabled={busy}
                            onChange={(event) =>
                              void updateUser(user, {
                                role: event.target.value as AppRole,
                              })
                            }
                            className="input w-auto min-w-[160px] py-1.5 text-sm"
                          >
                            <option value="ADMIN">Administrador</option>
                            <option value="SUPERVISOR">Supervisão</option>
                            <option value="EMPLOYEE">Funcionário</option>
                          </select>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void updateUser(user, { active: !user.active })
                            }
                            className="rounded-xl border border-adc-border px-3 py-1.5 text-sm font-semibold text-adc-navy disabled:opacity-60"
                          >
                            {user.active ? "Desativar" : "Ativar"}
                          </button>
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
    </div>
  );
}
