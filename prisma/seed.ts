import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../generated/prisma/client.js";
import bcrypt from "bcrypt";
import "dotenv/config";

async function upsertDepartment(
  prisma: PrismaClient,
  name: string,
) {
  return prisma.department.upsert({
    where: { name },
    update: { active: true },
    create: { name, active: true },
  });
}

async function upsertUserWithEmployee(
  prisma: PrismaClient,
  params: {
    email: string;
    name: string;
    password: string;
    role: Role;
    departmentId: string;
    phone?: string;
  },
) {
  const passwordHash = await bcrypt.hash(params.password, 10);

  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: {
      name: params.name,
      passwordHash,
      role: params.role,
      departmentId: params.departmentId,
      active: true,
    },
    create: {
      email: params.email,
      name: params.name,
      passwordHash,
      role: params.role,
      departmentId: params.departmentId,
      active: true,
    },
  });

  const employee = await prisma.employee.upsert({
    where: { email: params.email },
    update: {
      name: params.name,
      phone: params.phone ?? null,
      departmentId: params.departmentId,
      active: true,
    },
    create: {
      name: params.name,
      email: params.email,
      phone: params.phone ?? null,
      departmentId: params.departmentId,
      active: true,
    },
  });

  return { user, employee };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@estocke.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "troque-esta-senha";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Admin Estocke";

  const general = await upsertDepartment(prisma, "Geral");
  const ti = await upsertDepartment(prisma, "TI");
  const rh = await upsertDepartment(prisma, "RH");

  const { user: admin, employee: adminEmployee } = await upsertUserWithEmployee(
    prisma,
    {
      email: adminEmail,
      name: adminName,
      password: adminPassword,
      role: Role.ADMIN,
      departmentId: general.id,
    },
  );

  const { user: supervisor, employee: supervisorEmployee } =
    await upsertUserWithEmployee(prisma, {
      email: "supervisor@estocke.local",
      name: "Carla Supervisão",
      password: "troque-esta-senha",
      role: Role.SUPERVISOR,
      departmentId: ti.id,
      phone: "11999990010",
    });

  const { user: anaUser, employee: ana } = await upsertUserWithEmployee(prisma, {
    email: "ana.silva@estocke.local",
    name: "Ana Silva",
    password: "troque-esta-senha",
    role: Role.EMPLOYEE,
    departmentId: ti.id,
    phone: "11999990001",
  });

  const { user: brunoUser, employee: bruno } = await upsertUserWithEmployee(
    prisma,
    {
      email: "bruno.costa@estocke.local",
      name: "Bruno Costa",
      password: "troque-esta-senha",
      role: Role.EMPLOYEE,
      departmentId: rh.id,
      phone: "11999990002",
    },
  );

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
    prisma.product.upsert({
      where: { code: "SKU-NOTEBOOK" },
      update: {
        name: "Notebook corporativo",
        description: "Equipamento único de patrimônio",
        quantity: 1,
        minStock: 1,
        active: true,
      },
      create: {
        name: "Notebook corporativo",
        code: "SKU-NOTEBOOK",
        description: "Equipamento único de patrimônio",
        quantity: 1,
        minStock: 1,
        active: true,
      },
    }),
  ]);

  const [cabo, mouse, teclado, notebook] = products;

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
      { productId: notebook.id, employeeId: supervisorEmployee.id, quantity: 1 },
    ],
  });

  console.log("Seed OK — contas para QA:");
  console.log(`  ADMIN       ${admin.email} / ${adminPassword}`);
  console.log(`  SUPERVISOR  ${supervisor.email} / troque-esta-senha`);
  console.log(`  EMPLOYEE    ${anaUser.email} / troque-esta-senha`);
  console.log(`  EMPLOYEE    ${brunoUser.email} / troque-esta-senha`);
  console.log(
    `Departamentos: Geral, TI, RH | Produtos: ${products.map((p) => p.code).join(", ")}`,
  );
  console.log(`Admin employee id: ${adminEmployee.id}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
