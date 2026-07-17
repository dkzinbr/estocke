import { handleApiError, json, parseBoolean } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@generated/prisma/client";

export async function GET(request: Request) {
  try {
    await requireAuth(request, { roles: [Role.ADMIN] });
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const active = parseBoolean(searchParams.get("active"));

    const users = await prisma.user.findMany({
      where: {
        active,
        OR: search
          ? [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ]
          : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return json(users);
  } catch (err) {
    return handleApiError(err);
  }
}
