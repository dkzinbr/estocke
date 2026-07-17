import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../generated/prisma/client.js";
import bcrypt from "bcrypt";
import "dotenv/config";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@estocke.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "troque-esta-senha";
  const name = process.env.SEED_ADMIN_NAME ?? "Admin";

  const passwordHash = await bcrypt.hash(password, 10);

  const general = await prisma.department.upsert({
    where: { name: "Geral" },
    update: { active: true },
    create: { name: "Geral", active: true },
  });

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: Role.ADMIN,
      departmentId: general.id,
      active: true,
    },
    create: {
      email,
      name,
      passwordHash,
      role: Role.ADMIN,
      departmentId: general.id,
      active: true,
    },
  });

  await prisma.employee.upsert({
    where: { email },
    update: {
      name,
      departmentId: general.id,
      active: true,
    },
    create: {
      name,
      email,
      departmentId: general.id,
      active: true,
    },
  });

  const employees = await Promise.all([
    prisma.employee.upsert({
      where: { email: "ana.silva@estocke.local" },
      update: {
        name: "Ana Silva",
        phone: "11999990001",
        photoUrl: null,
        departmentId: general.id,
        active: true,
      },
      create: {
        name: "Ana Silva",
        email: "ana.silva@estocke.local",
        phone: "11999990001",
        photoUrl: null,
        departmentId: general.id,
        active: true,
      },
    }),
    prisma.employee.upsert({
      where: { email: "bruno.costa@estocke.local" },
      update: {
        name: "Bruno Costa",
        phone: "11999990002",
        photoUrl: null,
        departmentId: general.id,
        active: true,
      },
      create: {
        name: "Bruno Costa",
        email: "bruno.costa@estocke.local",
        phone: "11999990002",
        photoUrl: null,
        departmentId: general.id,
        active: true,
      },
    }),
  ]);

  const [ana, bruno] = employees;

  const products = await Promise.all([
    prisma.product.upsert({
      where: { code: "SKU-CABO-USB" },
      update: {
        name: "Cabo USB-C",
        description: "Cabo USB-C 1m",
        quantity: 40,
        minStock: 10,
        active: true,
      },
      create: {
        name: "Cabo USB-C",
        code: "SKU-CABO-USB",
        description: "Cabo USB-C 1m",
        quantity: 40,
        minStock: 10,
        active: true,
      },
    }),
    prisma.product.upsert({
      where: { code: "SKU-MOUSE" },
      update: {
        name: "Mouse sem fio",
        description: "Mouse óptico sem fio",
        quantity: 15,
        minStock: 5,
        active: true,
      },
      create: {
        name: "Mouse sem fio",
        code: "SKU-MOUSE",
        description: "Mouse óptico sem fio",
        quantity: 15,
        minStock: 5,
        active: true,
      },
    }),
    prisma.product.upsert({
      where: { code: "SKU-TECLADO" },
      update: {
        name: "Teclado mecânico",
        description: "Teclado mecânico ABNT2",
        quantity: 8,
        minStock: 4,
        active: true,
      },
      create: {
        name: "Teclado mecânico",
        code: "SKU-TECLADO",
        description: "Teclado mecânico ABNT2",
        quantity: 8,
        minStock: 4,
        active: true,
      },
    }),
  ]);

  const [cabo, mouse, teclado] = products;

  await prisma.productAssignment.deleteMany({
    where: {
      productId: { in: products.map((product) => product.id) },
    },
  });

  await prisma.productAssignment.createMany({
    data: [
      { productId: cabo.id, employeeId: ana.id, quantity: 2 },
      { productId: mouse.id, employeeId: ana.id, quantity: 1 },
      { productId: teclado.id, employeeId: bruno.id, quantity: 1 },
      { productId: cabo.id, employeeId: bruno.id, quantity: 1 },
    ],
  });

  console.log(`Seeded admin user: ${admin.email}`);
  console.log(`Seeded employees: ${employees.map((e) => e.email).join(", ")}`);
  console.log(`Seeded products: ${products.map((p) => p.code).join(", ")}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
