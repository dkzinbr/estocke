import type { ActivityType } from "@generated/prisma/client";

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  PRODUCT_CREATED: "Produto criado",
  PRODUCT_UPDATED: "Produto atualizado",
  PRODUCT_DELETED: "Produto excluído",
  EMPLOYEE_CREATED: "Funcionário cadastrado",
  EMPLOYEE_UPDATED: "Funcionário atualizado",
  EMPLOYEE_DELETED: "Funcionário excluído",
  DEPARTMENT_CREATED: "Departamento criado",
  DEPARTMENT_UPDATED: "Departamento atualizado",
  DEPARTMENT_DELETED: "Departamento excluído",
  REQUEST_CREATED: "Pedido criado",
  REQUEST_FULFILLED: "Pedido atendido",
  REQUEST_CANCELLED: "Pedido cancelado",
  MALFUNCTION_REPORTED: "Mal funcionamento",
  MALFUNCTION_RESOLVED: "Mal funcionamento resolvido",
  MALFUNCTION_DELETED: "Mal funcionamento excluído",
  ASSIGNMENT_ACQUIRED: "Aquisição / transferência",
  MALFUNCTION_MOVEMENT: "Saída por mal funcionamento",
  USER_UPDATED: "Usuário atualizado",
  USER_REGISTERED: "Conta criada",
  STOCK_ADJUSTED: "Ajuste de estoque",
};
