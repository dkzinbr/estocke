import { handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { saveEmployeePhoto } from "@/lib/employee-photos";
import { Role } from "@generated/prisma/client";

export async function POST(request: Request) {
  try {
    await requireAuth(request, { roles: [Role.ADMIN] });

    const formData = await request.formData();
    const file = formData.get("photo");

    if (!(file instanceof File) || file.size === 0) {
      return json({ error: "Selecione uma foto para enviar." }, { status: 400 });
    }

    const photoUrl = await saveEmployeePhoto(file);
    return json({ photoUrl }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
