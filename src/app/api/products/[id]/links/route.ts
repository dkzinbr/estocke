import { ApiError, error, handleApiError, json } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { withAssignedQuantity } from "@/lib/product-assignments";
import { prisma } from "@/lib/prisma";
import type { IdRouteContext } from "@/lib/route";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const createLinkSchema = z.object({
  childId: z.string().trim().min(1),
  quantity: z.number().int().min(1),
  note: z.string().trim().optional().nullable(),
});

const linkInclude = {
  child: {
    select: {
      id: true,
      name: true,
      code: true,
      quantity: true,
      active: true,
    },
  },
  parent: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
} as const;

export async function GET(request: Request, ctx: IdRouteContext) {
  try {
    await requireAuth(request);
    const { id } = await ctx.params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!product) return error("Produto não encontrado.", 404);

    const links = await prisma.productLink.findMany({
      where: { parentId: id },
      include: linkInclude,
      orderBy: { createdAt: "desc" },
    });

    return json(links);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, ctx: IdRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id: parentId } = await ctx.params;
    const { childId, quantity, note } = createLinkSchema.parse(
      await request.json(),
    );

    if (childId === parentId) {
      throw new ApiError(
        "Um produto não pode ser vinculado a si mesmo.",
        400,
      );
    }

    const link = await prisma.$transaction(async (tx) => {
      const [parent, child] = await Promise.all([
        tx.product.findUnique({
          where: { id: parentId },
          select: { id: true, name: true, code: true },
        }),
        tx.product.findUnique({
          where: { id: childId },
          include: {
            assignments: { select: { quantity: true } },
            parentLinks: { select: { quantity: true } },
          },
        }),
      ]);

      if (!parent) throw new ApiError("Produto pai não encontrado.", 404);
      if (!child) throw new ApiError("Produto componente não encontrado.", 404);

      const childWithAvailability = withAssignedQuantity(child);
      if (quantity > childWithAvailability.availableQuantity) {
        throw new ApiError(
          `Estoque insuficiente para "${child.name}". Disponível: ${childWithAvailability.availableQuantity} de ${child.quantity}.`,
          400,
        );
      }

      const created = await tx.productLink.create({
        data: {
          parentId,
          childId,
          quantity,
          note: note || null,
        },
        include: linkInclude,
      });

      await logActivity(tx, {
        type: "PRODUCT_LINKED",
        summary: `Componente vinculado: ${child.name} × ${quantity} → ${parent.name}`,
        detail: note || undefined,
        actor: actorFromUser(user),
        entityType: "product",
        entityId: parentId,
      });

      return created;
    });

    return json(link, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
