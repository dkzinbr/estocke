import { Prisma } from "@generated/prisma/client";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function error(message: string, status = 400, details?: unknown) {
  return json({ error: message, details }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return error(err.message, err.status, err.details);
  }

  if (err instanceof ZodError) {
    return error("Dados inválidos.", 422, err.flatten());
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return error("Registro duplicado.", 409, err.meta);
    }

    if (err.code === "P2025") {
      return error("Registro não encontrado.", 404);
    }

    if (err.code === "P2003") {
      return error("Registro relacionado impede esta operação.", 409, err.meta);
    }
  }

  console.error(err);
  return error("Erro interno do servidor.", 500);
}

export function parseBoolean(value: string | null) {
  if (value === null) return undefined;
  return value === "true";
}
