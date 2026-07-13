import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client.js";
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

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: Role.ADMIN,
      active: true,
    },
    create: {
      email,
      name,
      passwordHash,
      role: Role.ADMIN,
      active: true,
    },
  });

  console.log(`Seeded admin user: ${admin.email}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
