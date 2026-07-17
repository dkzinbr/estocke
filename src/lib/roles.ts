export type AppRole = "ADMIN" | "SUPERVISOR" | "EMPLOYEE";

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisão",
  EMPLOYEE: "Funcionário",
};

export function isAdminRole(role: string | null | undefined): role is "ADMIN" {
  return role === "ADMIN";
}

export function isSupervisorRole(
  role: string | null | undefined,
): role is "SUPERVISOR" {
  return role === "SUPERVISOR";
}

/** Admin ou supervisão — veem pedidos/malfuncionamentos gerais. */
export function canViewAllOperations(role: string | null | undefined) {
  return role === "ADMIN" || role === "SUPERVISOR";
}

/** Só admin cadastra/edita catálogo e atende pedidos. */
export function canManageCatalog(role: string | null | undefined) {
  return role === "ADMIN";
}

/** Pedidos/malfunc para outras pessoas: só admin. */
export function canActForOthers(role: string | null | undefined) {
  return role === "ADMIN";
}
