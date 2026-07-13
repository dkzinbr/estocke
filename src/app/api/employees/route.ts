import { handleApiError, json, parseBoolean } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional().nullable(),
  jobTitle: z.string().trim().optional().nullable(),
  active: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const active = parseBoolean(searchParams.get("active"));

    const employees = await prisma.employee.findMany({
      where: {
        active,
        OR: search
          ? [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { jobTitle: { contains: search, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: { name: "asc" },
    });

    return json(employees);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const data = createEmployeeSchema.parse(await request.json());
    const employee = await prisma.employee.create({ data });

    return json(employee, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
