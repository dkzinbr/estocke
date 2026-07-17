import { ApiError, handleApiError, json, parseBoolean } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do departamento."),
  active: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const includeInactive = searchParams.get("all") === "true";

    if (includeInactive) {
      await requireAuth(request, { roles: [Role.ADMIN] });
    }

    const activeParam = searchParams.get("active");
    const active =
      includeInactive && activeParam === "all"
        ? undefined
        : includeInactive && activeParam != null
          ? parseBoolean(activeParam)
          : true;

    const departments = await prisma.department.findMany({
      where: {
        ...(active !== undefined ? { active } : {}),
        ...(search
          ? { name: { contains: search, mode: "insensitive" } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        _count: includeInactive
          ? { select: { users: true, employees: true } }
          : undefined,
      },
      orderBy: { name: "asc" },
    });

    return json(departments);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const data = createSchema.parse(await request.json());

    const existing = await prisma.department.findFirst({
      where: { name: { equals: data.name, mode: "insensitive" } },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError("Já existe um departamento com este nome.", 409);
    }

    const department = await prisma.department.create({
      data: {
        name: data.name,
        active: data.active,
      },
      include: {
        _count: { select: { users: true, employees: true } },
      },
    });

    await logActivity(prisma, {
      type: "DEPARTMENT_CREATED",
      summary: `Departamento criado: ${department.name}`,
      actor: actorFromUser(user),
      entityType: "department",
      entityId: department.id,
    });

    return json(department, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
