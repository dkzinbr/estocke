import { clearSession, getSession } from "@/lib/client/session";

type ApiFetchOptions = RequestInit & {
  query?: Record<string, string | number | boolean | null | undefined>;
};

export class ClientApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  { query, headers, body, ...init }: ApiFetchOptions = {},
): Promise<T> {
  const url = new URL(path, window.location.origin);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const session = getSession();
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...headers,
    },
    body,
  });

  if (response.status === 401) {
    clearSession();
    window.location.replace("/login");
    throw new ClientApiError("Sessão expirada.", 401);
  }

  if (!response.ok) {
    const payload = await safeJson(response);
    throw new ClientApiError(
      payload?.error ?? "Erro ao comunicar com o servidor.",
      response.status,
      payload?.details,
    );
  }

  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value);
}

async function safeJson(response: Response) {
  try {
    return (await response.json()) as { error?: string; details?: unknown };
  } catch {
    return null;
  }
}
