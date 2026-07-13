import { handleApiError, json } from "@/lib/api";
import { consumeLoginVerification, signAuthToken } from "@/lib/auth";
import { z } from "zod";

const verifySchema = z.object({
  token: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const { token } = verifySchema.parse(await request.json());
    const user = await consumeLoginVerification(token);

    const authToken = signAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return json({
      token: authToken,
      expiresIn: "3h",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
