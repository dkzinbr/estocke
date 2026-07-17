import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany({ take: 1 });
  if (!users.length) {
    throw new Error("No users found after seed.");
  }

  console.log("✅ Connected.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
