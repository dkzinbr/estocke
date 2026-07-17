import type { AppRole } from "@/lib/roles";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

export type Session = {
  token: string;
  user: SessionUser;
};

const TOKEN_KEY = "estocke_token";
const USER_KEY = "estocke_user";

/** Reads JWT `exp` (ms). Returns null if missing/invalid. */
export function getTokenExpiresAt(token: string): number | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const parsed = JSON.parse(atob(padded)) as { exp?: unknown };

    return typeof parsed.exp === "number" ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isSessionExpired(token: string, now = Date.now()) {
  const expiresAt = getTokenExpiresAt(token);
  if (expiresAt == null) return true;
  return expiresAt <= now;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;

  const token = window.localStorage.getItem(TOKEN_KEY);
  const userJson = window.localStorage.getItem(USER_KEY);

  if (!token || !userJson) return null;

  if (isSessionExpired(token)) {
    clearSession();
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(userJson) as SessionUser,
    };
  } catch {
    clearSession();
    return null;
  }
}

export function setSession(session: Session) {
  window.localStorage.setItem(TOKEN_KEY, session.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
