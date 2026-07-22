import { error, handleApiError } from "@/lib/api";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NestedLinkRouteContext } from "@/lib/route";
import { Role } from "@generated/prisma/client";

export async function DELETE(request: Request, ctx: NestedLinkRouteContext) {
  try {
    const user = await requireAuth(request, { roles: [Role.ADMIN] });
    const { id: parentId, linkId } = await ctx.params;

    const link = await prisma.productLink.findFirst({
      where: { id: linkId, parentId },
      include: {
        child: { select: { name: true, code: true } },
        parent: { select: { name: true, code: true } },
      },
    });

    if (!link) return error("Vínculo não encontrado.", 404);

    await prisma.$transaction(async (tx) => {
      await tx.productLink.delete({ where: { id: link.id } });

      await logActivity(tx, {
        type: "PRODUCT_UNLINKED",
        summary: `Componente desvinculado: ${link.child.name} × ${link.quantity} ← ${link.parent.name}`,
        actor: actorFromUser(user),
        entityType: "product",
        entityId: parentId,
      });
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
