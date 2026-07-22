import { handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLowAvailableStock } from "@/lib/product-status";

const employeeSummarySelect = {
  id: true,
  name: true,
  email: true,
  photoUrl: true,
  department: {
    select: { id: true, name: true },
  },
} as const;

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const [
      productCount,
      employeeCount,
      departmentCount,
      malfunctionCount,
      activeProducts,
      recentEvents,
      openMalfunctions,
      products,
      employees,
    ] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.employee.count({ where: { active: true } }),
      prisma.department.count({ where: { active: true } }),
      prisma.productMalfunction.count({ where: { active: true } }),
      prisma.product.findMany({
        where: { active: true },
        include: {
          assignments: { select: { quantity: true } },
          parentLinks: { select: { quantity: true } },
        },
        orderBy: { quantity: "asc" },
      }),
      prisma.activityEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.productMalfunction.findMany({
        where: { active: true },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          description: true,
          createdAt: true,
          product: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.product.findMany({
        orderBy: { name: "asc" },
        take: 50,
      }),
      prisma.employee.findMany({
        orderBy: { name: "asc" },
        take: 50,
        select: {
          ...employeeSummarySelect,
          phone: true,
          active: true,
          departmentId: true,
        },
      }),
    ]);

    const withAvailability = activeProducts.map((product) => {
      const assignedQuantity = product.assignments.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const linkedQuantity = product.parentLinks.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const availableQuantity = Math.max(
        product.quantity - assignedQuantity - linkedQuantity,
        0,
      );
      return {
        id: product.id,
        name: product.name,
        code: product.code,
        quantity: product.quantity,
        minStock: product.minStock,
        availableQuantity,
      };
    });

    const lowStockProducts = withAvailability
      .filter(isLowAvailableStock)
      .sort((a, b) => a.availableQuantity - b.availableQuantity);

    return json({
      counts: {
        products: productCount,
        employees: employeeCount,
        departments: departmentCount,
        lowStock: lowStockProducts.length,
        malfunctions: malfunctionCount,
      },
      lowStockProducts,
      openMalfunctions,
      recentEvents,
      products,
      employees,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
