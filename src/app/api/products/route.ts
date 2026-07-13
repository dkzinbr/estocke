import { handleApiError, json, parseBoolean } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  quantity: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  price: z.coerce.number().min(0).default(0),
  active: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const active = parseBoolean(searchParams.get("active"));

    const products = await prisma.product.findMany({
      where: {
        active,
        OR: search
          ? [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: { name: "asc" },
    });

    return json(products);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const data = createProductSchema.parse(await request.json());
    const product = await prisma.product.create({ data });

    return json(product, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
