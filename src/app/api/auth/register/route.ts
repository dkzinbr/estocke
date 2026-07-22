import { handleApiError, json } from "@/lib/api";

/** Cadastro público desativado — contas são criadas pelo admin em Funcionários. */
export async function POST() {
  try {
    return json(
      {
        error:
          "O cadastro público está desativado. Peça ao administrador para criar sua conta em Funcionários.",
      },
      { status: 403 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
