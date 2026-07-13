import { error, handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { IdRouteContext } from "@/lib/route";
import { z } from "zod";

const updateEmployeeSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().optional().nullable(),
  jobTitle: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request);
    const { id } = await ctx.params;
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        stockMovements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { product: true },
        },
      },
    });

    if (!employee) return error("Employee not found.", 404);

    return json(employee);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request);
    const { id } = await ctx.params;
    const data = updateEmployeeSchema.parse(await request.json());
    const employee = await prisma.employee.update({
      where: { id },
      data,
    });

    return json(employee);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request);
    const { id } = await ctx.params;
    await prisma.employee.delete({ where: { id } });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
