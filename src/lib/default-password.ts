/** Senha inicial aplicada pelo admin ao criar funcionário. */
export const DEFAULT_USER_PASSWORD =
  process.env.DEFAULT_USER_PASSWORD?.trim() || "troque-esta-senha";

export function getDefaultUserPassword() {
  return DEFAULT_USER_PASSWORD;
}
