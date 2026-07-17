import { handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      historyCount,
      departmentCount,
      lowStockProducts,
      recentEvents,
      products,
      employees,
    ] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.employee.count({ where: { active: true } }),
      prisma.activityEvent.count(),
      prisma.department.count({ where: { active: true } }),
      prisma.product.findMany({
        where: { active: true },
        orderBy: { quantity: "asc" },
      }),
      prisma.activityEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
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

    const lowStock = lowStockProducts.filter((p) => p.quantity < p.minStock);

    return json({
      counts: {
        products: productCount,
        employees: employeeCount,
        history: historyCount,
        departments: departmentCount,
        lowStock: lowStock.length,
      },
      lowStockProducts: lowStock,
      recentEvents,
      products,
      employees,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
