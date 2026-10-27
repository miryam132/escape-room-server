import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { registerSchema } from "../src/schemas/index.js";
const db = new PrismaClient();
try {
  const input = registerSchema.parse({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  if (await db.user.findUnique({ where: { email: input.email } }))
    throw new Error(
      "Email already exists. This command never promotes or overwrites an existing user.",
    );
  await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: "ADMIN",
    },
  });
  console.log(
    "Administrator created. Remove ADMIN_PASSWORD from your environment after use.",
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : "Admin creation failed");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
