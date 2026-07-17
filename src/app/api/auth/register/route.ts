import { ApiError, handleApiError, json } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { signAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@generated/prisma/client";
import bcrypt from "bcrypt";
import { z } from "zod";

const ALLOWED_EMAIL_DOMAIN = "@adcbeneficios.com.br";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome válido."),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .refine(
      (value) => value.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN),
      `Use um e-mail ${ALLOWED_EMAIL_DOMAIN}.`,
    ),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  departmentId: z.string().trim().min(1, "Selecione um departamento."),
});

export async function POST(request: Request) {
  try {
    const { name, email, password, departmentId } = registerSchema.parse(
      await request.json(),
    );
    const normalizedEmail = email.toLowerCase();

    if (!normalizedEmail.endsWith(ALLOWED_EMAIL_DOMAIN)) {
      throw new ApiError(`Use um e-mail ${ALLOWED_EMAIL_DOMAIN}.`, 400);
    }

    const department = await prisma.department.findFirst({
      where: { id: departmentId, active: true },
      select: { id: true },
    });

    if (!department) {
      throw new ApiError("Departamento inválido ou inativo.", 400);
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError("Já existe uma conta com este e-mail.", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
          role: Role.EMPLOYEE,
          departmentId: department.id,
          active: true,
        },
      });

      await tx.employee.upsert({
        where: { email: normalizedEmail },
        update: {
          name,
          active: true,
          departmentId: department.id,
        },
        create: {
          name,
          email: normalizedEmail,
          departmentId: department.id,
          active: true,
        },
      });

      await logActivity(tx, {
        type: "USER_REGISTERED",
        summary: `Conta criada: ${createdUser.name}`,
        actor: { id: createdUser.id, name: createdUser.name },
        entityType: "user",
        entityId: createdUser.id,
      });

      return createdUser;
    });

    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return json(
      {
        token,
        expiresIn: "3h",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
