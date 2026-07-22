import { ApiError, handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getDefaultUserPassword } from "@/lib/default-password";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z
      .string()
      .min(6, "A nova senha deve ter pelo menos 6 caracteres."),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "A nova senha deve ser diferente da senha atual.",
    path: ["newPassword"],
  })
  .refine((data) => data.newPassword !== getDefaultUserPassword(), {
    message: "Escolha uma senha diferente da senha inicial padrão.",
    path: ["newPassword"],
  });

export async function POST(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const body = changePasswordSchema.parse(await request.json());

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        passwordHash: true,
        mustChangePassword: true,
      },
    });

    if (!user) {
      throw new ApiError("Usuário não encontrado.", 404);
    }

    const currentValid = await bcrypt.compare(
      body.currentPassword,
      user.passwordHash,
    );
    if (!currentValid) {
      throw new ApiError("Senha atual incorreta.", 400);
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return json({
      ok: true,
      user: {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        role: authUser.role,
        mustChangePassword: false,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
