import { handleApiError, json } from "@/lib/api";
import { ACTIVITY_TYPE_LABELS } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivityType } from "@generated/prisma/client";

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const typeParam = searchParams.get("type")?.trim();
    const type =
      typeParam && Object.values(ActivityType).includes(typeParam as ActivityType)
        ? (typeParam as ActivityType)
        : undefined;

    const events = await prisma.activityEvent.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(search
          ? {
              OR: [
                { summary: { contains: search, mode: "insensitive" } },
                { detail: { contains: search, mode: "insensitive" } },
                { actorName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return json(
      events.map((event) => ({
        ...event,
        typeLabel: ACTIVITY_TYPE_LABELS[event.type],
      })),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
