import { ApiError, handleApiError, json } from "@/lib/api";
import { signAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { email, password } = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.active) {
      throw new ApiError("Credenciais inválidas.", 401);
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      throw new ApiError("Credenciais inválidas.", 401);
    }

    await prisma.employee.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        active: true,
        departmentId: user.departmentId,
        userId: user.id,
      },
      create: {
        name: user.name,
        email: user.email,
        active: true,
        departmentId: user.departmentId,
        userId: user.id,
      },
    });

    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return json({
      token,
      expiresIn: "3h",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
