import { PrismaClient } from "@prisma/client";
import { resetDemoData } from "../prisma/seed";

const prisma = new PrismaClient();

resetDemoData(prisma)
  .then(() => console.log("Demo 数据已重置。"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
