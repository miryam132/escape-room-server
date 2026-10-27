import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { db } from "../db.js";
import { AppError } from "../errors.js";
import { idSchema } from "../schemas/index.js";
export const authenticate: RequestHandler = async (req, res, next) => {
  const match = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
  if (!match)
    throw new AppError(401, "UNAUTHORIZED", "A Bearer token is required");
  let userId: string;
  try {
    const payload = jwt.verify(match[1], env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "escape-room-server",
      audience: "escape-room-client",
    });
    if (typeof payload === "string") throw new Error();
    userId = idSchema.parse(payload.sub);
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired token");
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) throw new AppError(401, "UNAUTHORIZED", "User no longer exists");
  res.locals.user = user;
  next();
};
export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals.user.role !== "ADMIN")
    throw new AppError(403, "FORBIDDEN", "Administrator access is required");
  next();
};
