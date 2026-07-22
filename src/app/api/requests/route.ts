import { ApiError, handleApiError, json } from "@/lib/api";
import {
  canManageAllRequests,
  canRequestForOthers,
  requireLinkedEmployee,
} from "@/lib/access";
import { actorFromUser, logActivity } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { withAssignedQuantity } from "@/lib/product-assignments";
import {
  canRequestProduct,
  requestBlockMessage,
} from "@/lib/product-request-rules";
import { getStockStatus } from "@/lib/product-status";
import { prisma } from "@/lib/prisma";
import { Role } from "@generated/prisma/client";
import { z } from "zod";

const createSchema = z.object({
  productId: z.string().trim().min(1),
  employeeId: z.string().trim().min(1),
  note: z.string().trim().optional().nullable(),
});

const requestInclude = {
  employee: {
    select: {
      id: true,
      name: true,
      email: true,
      photoUrl: true,
      department: {
        select: { id: true, name: true },
      },
    },
  },
  product: {
    include: {
      assignments: {
        select: { quantity: true },
      },
      parentLinks: {
        select: { quantity: true },
      },
      malfunctions: {
        where: { active: true },
        select: { id: true },
        take: 1,
      },
      requests: {
        where: { status: "OPEN" },
        select: { id: true },
        take: 1,
      },
    },
  },
} as const;

function serializeRequest<
  T extends {
    product: {
      quantity: number;
      assignments?: { quantity: number }[];
      parentLinks?: { quantity: number }[];
      malfunctions?: { id: string }[];
      requests?: { id: string }[];
    };
  },
>(request: T) {
  const product = withAssignedQuantity(request.product);
  const hasOpenMalfunction = (request.product.malfunctions?.length ?? 0) > 0;
  const hasOpenRequest = (request.product.requests?.length ?? 0) > 0;
  return {
    ...request,
    product: {
      ...product,
      hasOpenMalfunction,
      hasOpenRequest,
      stockStatus: getStockStatus({
        ...product,
        hasOpenMalfunction,
        hasOpenRequest,
      }),
    },
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const search = searchParams.get("search")?.trim();

    const selfEmployee = canManageAllRequests(user.role)
      ? null
      : await requireLinkedEmployee(user);

    const requests = await prisma.productRequest.findMany({
      where: {
        status:
          status && ["OPEN", "FULFILLED", "CANCELLED"].includes(status)
            ? (status as "OPEN" | "FULFILLED" | "CANCELLED")
            : "OPEN",
        ...(selfEmployee ? { employeeId: selfEmployee.id } : {}),
        OR: search
          ? [
              { employee: { name: { contains: search, mode: "insensitive" } } },
              { employee: { email: { contains: search, mode: "insensitive" } } },
              {
                employee: {
                  department: {
                    name: { contains: search, mode: "insensitive" },
                  },
                },
              },
              { product: { name: { contains: search, mode: "insensitive" } } },
              { product: { code: { contains: search, mode: "insensitive" } } },
            ]
          : undefined,
      },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    });

    return json(requests.map(serializeRequest));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const data = createSchema.parse(await request.json());

    let employeeId = data.employeeId;
    if (!canRequestForOthers(user.role)) {
      const self = await requireLinkedEmployee(user);
      employeeId = self.id;
    }

    const [product, employee] = await Promise.all([
      prisma.product.findUnique({
        where: { id: data.productId },
        include: {
          assignments: { select: { quantity: true } },
          parentLinks: { select: { quantity: true } },
          malfunctions: {
            where: { active: true },
            select: { id: true },
            take: 1,
          },
        },
      }),
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, active: true, name: true },
      }),
    ]);

    if (!product) throw new ApiError("Produto não encontrado.", 404);
    if (!employee || !employee.active) {
      throw new ApiError("Funcionário não encontrado ou inativo.", 404);
    }

    const productWithAvailability = withAssignedQuantity(product);
    if (
      !canRequestProduct({
        quantity: productWithAvailability.quantity,
        availableQuantity: productWithAvailability.availableQuantity,
        hasOpenMalfunction: product.malfunctions.length > 0,
      })
    ) {
      throw new ApiError(requestBlockMessage(product.name), 409);
    }

    const created = await prisma.productRequest.create({
      data: {
        productId: data.productId,
        employeeId,
        note: data.note || null,
      },
      include: requestInclude,
    });

    await logActivity(prisma, {
      type: "REQUEST_CREATED",
      summary: `Pedido criado: ${product.name} para ${employee.name}`,
      actor: actorFromUser(user),
      entityType: "request",
      entityId: created.id,
    });

    return json(serializeRequest(created), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
