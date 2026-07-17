import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@generated/prisma/client";
import jwt from "jsonwebtoken";

export type TokenPayload = {
  sub: string;
  email: string;
  role: Role;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/** Auth JWT valid for 3 hours. */
const AUTH_TOKEN_TTL = "3h";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new ApiError("JWT_SECRET não configurado.", 500);
  }

  return secret;
}

export function signAuthToken(payload: TokenPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: AUTH_TOKEN_TTL });
}

export function verifyAuthToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof decoded.sub !== "string" ||
      typeof decoded.email !== "string" ||
      typeof decoded.role !== "string"
    ) {
      throw new ApiError("Token inválido.", 401);
    }

    if (
      decoded.role !== Role.ADMIN &&
      decoded.role !== Role.SUPERVISOR &&
      decoded.role !== Role.EMPLOYEE
    ) {
      throw new ApiError("Token inválido.", 401);
    }

    return {
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("Token inválido ou expirado.", 401);
  }
}

function extractBearerToken(request: Request) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    throw new ApiError("Autenticação necessária.", 401);
  }

  const token = header.slice("Bearer ".length).trim();

  if (!token) {
    throw new ApiError("Autenticação necessária.", 401);
  }

  return token;
}

/**
 * Authenticates the request with dual verification:
 * 1) Valid JWT (signature + 3h expiration)
 * 2) User still exists, is active, and claims match the database
 */
export async function requireAuth(
  request: Request,
  options?: { roles?: Role[] },
): Promise<AuthUser> {
  const token = extractBearerToken(request);
  const payload = verifyAuthToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
    },
  });

  if (!user || !user.active) {
    throw new ApiError("Sessão inválida.", 401);
  }

  if (user.email !== payload.email || user.role !== payload.role) {
    throw new ApiError("Sessão inválida.", 401);
  }

  if (options?.roles && !options.roles.includes(user.role)) {
    throw new ApiError("Acesso negado.", 403);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}
