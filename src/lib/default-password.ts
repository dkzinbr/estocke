/** Senha inicial aplicada pelo admin ao criar funcionário. */
/** Lida em tempo de execução: sem valor padrão no código. */
export function getDefaultUserPassword() {
  const value = process.env.DEFAULT_USER_PASSWORD?.trim();
  if (!value) {
    throw new Error("DEFAULT_USER_PASSWORD não configurado (veja .env.example).");
  }
  return value;
}
