import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { env, origins } from "./config/env.js";
import { router } from "./routes/index.js";
import { errorHandler } from "./middleware/errors.js";
import { AppError } from "./errors.js";
import { db } from "./db.js";
export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);
app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origins.includes(origin)) cb(null, true);
      else cb(new AppError(403, "CORS_REJECTED", "Origin is not allowed"));
    },
  }),
);
app.use(express.json({ limit: "64kb" }));
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.get("/api/health", async (_req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
const spec = JSON.parse(
  readFileSync(path.resolve("docs/openapi.json"), "utf8"),
);
app.get("/openapi.json", (_req, res) => {
  res.json(spec);
});
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(spec, {
    swaggerOptions: { persistAuthorization: false },
    customSiteTitle: "Escape Room API",
  }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 180,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: { code: "RATE_LIMITED", message: "Too many requests. Try later." },
    },
  }),
  router,
);
app.use((_req, _res, next) =>
  next(new AppError(404, "NOT_FOUND", "Endpoint not found")),
);
app.use(errorHandler);
