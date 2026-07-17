import type { ActivityType, Prisma } from "@generated/prisma/client";
import type { AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export { ACTIVITY_TYPE_LABELS } from "@/lib/activity-labels";

type Db = Prisma.TransactionClient | typeof prisma;

export type ActivityActor = {
  id?: string | null;
  name?: string | null;
};

export function actorFromUser(user?: AuthUser | null): ActivityActor {
  if (!user) return {};
  return { id: user.id, name: user.name };
}

export async function logActivity(
  db: Db,
  params: {
    type: ActivityType;
    summary: string;
    detail?: string | null;
    actor?: ActivityActor | null;
    entityType?: string | null;
    entityId?: string | null;
  },
) {
  return db.activityEvent.create({
    data: {
      type: params.type,
      summary: params.summary,
      detail: params.detail || null,
      actorUserId: params.actor?.id || null,
      actorName: params.actor?.name || null,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
    },
  });
}
