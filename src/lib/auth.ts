import { createHash, randomBytes } from "crypto";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
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

/** Email confirmation link valid for 15 minutes. */
const EMAIL_VERIFY_TTL_MS = 15 * 60 * 1000;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new ApiError("JWT_SECRET is not configured.", 500);
  }

  return secret;
}

export function signAuthToken(payload: TokenPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: AUTH_TOKEN_TTL });
}

/** First check: JWT signature and expiration. */
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
      throw new ApiError("Invalid token.", 401);
    }

    if (decoded.role !== Role.ADMIN && decoded.role !== Role.EMPLOYEE) {
      throw new ApiError("Invalid token.", 401);
    }

    return {
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("Invalid or expired token.", 401);
  }
}

function extractBearerToken(request: Request) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    throw new ApiError("Authentication required.", 401);
  }

  const token = header.slice("Bearer ".length).trim();

  if (!token) {
    throw new ApiError("Authentication required.", 401);
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
    throw new ApiError("Invalid session.", 401);
  }

  if (user.email !== payload.email || user.role !== payload.role) {
    throw new ApiError("Invalid session.", 401);
  }

  if (options?.roles && !options.roles.includes(user.role)) {
    throw new ApiError("Access denied.", 403);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createVerificationToken() {
  return randomBytes(32).toString("hex");
}

/** Creates an email confirmation token (invalidates unused previous ones). */
export async function createLoginVerification(userId: string) {
  const token = createVerificationToken();
  const tokenHash = hashVerificationToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);

  await prisma.$transaction([
    prisma.loginVerification.deleteMany({
      where: {
        userId,
        usedAt: null,
      },
    }),
    prisma.loginVerification.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return { token, expiresAt };
}

export async function consumeLoginVerification(token: string) {
  const tokenHash = hashVerificationToken(token);
  const verification = await prisma.loginVerification.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
        },
      },
    },
  });

  if (!verification || verification.usedAt) {
    throw new ApiError("Invalid verification link.", 401);
  }

  if (verification.expiresAt.getTime() < Date.now()) {
    throw new ApiError("Verification link expired.", 401);
  }

  if (!verification.user.active) {
    throw new ApiError("Inactive user.", 401);
  }

  await prisma.loginVerification.update({
    where: { id: verification.id },
    data: { usedAt: new Date() },
  });

  return verification.user;
}
