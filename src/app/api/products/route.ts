import { handleApiError, json, parseBoolean } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import {
  productAssignmentInclude,
  withAssignedQuantity,
} from "@/lib/product-assignments";
import {
  productOpenMalfunctionInclude,
  productOpenRequestInclude,
  withProductDemandFlags,
} from "@/lib/product-request-rules";
import { prisma } from "@/lib/prisma";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  quantity: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
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
      include: {
        ...productAssignmentInclude,
        ...productOpenMalfunctionInclude,
        ...productOpenRequestInclude,
      },
      orderBy: { name: "asc" },
    });

    return json(
      products.map((product) =>
        withAssignedQuantity(withProductDemandFlags(product)),
      ),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const data = createProductSchema.parse(await request.json());
    const product = await prisma.product.create({
      data,
      include: {
        ...productAssignmentInclude,
        ...productOpenMalfunctionInclude,
        ...productOpenRequestInclude,
      },
    });

    await logActivity(prisma, {
      type: "PRODUCT_CREATED",
      summary: `Produto criado: ${product.name} (${product.code})`,
      actor: actorFromUser(user),
      entityType: "product",
      entityId: product.id,
    });

    return json(withAssignedQuantity(withProductDemandFlags(product)), {
      status: 201,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
