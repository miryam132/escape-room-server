import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db.js";
import { env } from "../config/env.js";
import { AppError } from "../errors.js";
import type { User } from "@prisma/client";
const dummyHash = bcrypt.hashSync("not-a-real-user-password", 12);
const session = (u: User) => ({
  user: { id: u.id, name: u.name, email: u.email, role: u.role },
  token: jwt.sign({}, env.JWT_SECRET, {
    subject: u.id,
    expiresIn: "2h",
    algorithm: "HS256",
    issuer: "escape-room-server",
    audience: "escape-room-client",
  }),
  expiresIn: 7200,
});
export async function register(input: {
  name: string;
  email: string;
  password: string;
}) {
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: "PLAYER",
    },
  });
  return session(user);
}
export async function login(input: { email: string; password: string }) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(
    input.password,
    user?.passwordHash || dummyHash,
  );
  if (!user || !valid)
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Incorrect email or password",
    );
  return session(user);
}
