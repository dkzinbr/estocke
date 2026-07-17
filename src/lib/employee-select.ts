import type { Prisma } from "@generated/prisma/client";

export const employeeSummarySelect = {
  id: true,
  name: true,
  email: true,
  photoUrl: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.EmployeeSelect;

export const employeeMovementInclude = {
  product: true,
  employee: {
    select: employeeSummarySelect,
  },
} satisfies Prisma.StockMovementInclude;
