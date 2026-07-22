import { ApiError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@generated/prisma/client";

export async function findEmployeeForUser(user: AuthUser) {
  const byUserId = await prisma.employee.findUnique({
    where: { userId: user.id },
  });
  if (byUserId) return byUserId;

  return prisma.employee.findUnique({
    where: { email: user.email },
  });
}

export async function requireLinkedEmployee(user: AuthUser) {
  const employee = await findEmployeeForUser(user);
  if (!employee || !employee.active) {
    throw new ApiError(
      "Seu usuário não está vinculado a um funcionário. Peça ao administrador para cadastrar um funcionário com o mesmo e-mail.",
      400,
    );
  }
  return employee;
}

export function canManageAllRequests(role: Role) {
  return role === Role.ADMIN || role === Role.SUPERVISOR;
}

export function canRequestForOthers(role: Role) {
  return role === Role.ADMIN;
}

export function canManagePlatform(role: Role) {
  return role === Role.ADMIN;
}
