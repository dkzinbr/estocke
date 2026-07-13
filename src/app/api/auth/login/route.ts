import { ApiError, handleApiError, json } from "@/lib/api";
import { createLoginVerification } from "@/lib/auth";
import { sendLoginVerificationEmail } from "@/lib/email";
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
      throw new ApiError("Invalid credentials.", 401);
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      throw new ApiError("Invalid credentials.", 401);
    }

    const { token } = await createLoginVerification(user.id);
    const emailResult = await sendLoginVerificationEmail({
      to: user.email,
      name: user.name,
      token,
    });

    return json({
      requiresEmailVerification: true,
      message:
        "We sent an email with a button to confirm your access. The link expires in 15 minutes.",
      ...(emailResult.previewOnly
        ? { previewUrl: emailResult.verifyUrl }
        : {}),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
