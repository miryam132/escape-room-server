import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z
    .string()
    .min(32)
    .refine((v) => !v.startsWith("REPLACE_"), "Generate a real JWT_SECRET"),
  CORS_ORIGINS: z.string().min(1).default("http://localhost:5173"),
  TRUST_PROXY: z.coerce.number().int().min(0).max(3).default(0),
  CLOUDINARY_CLOUD_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("room-images"),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success)
  throw new Error(
    "Invalid environment variables: " +
      parsed.error.issues
        .map((i) => i.path.join(".") + ": " + i.message)
        .join("; "),
  );
export const env = parsed.data;
export const origins = env.CORS_ORIGINS.split(",").map((v) => v.trim());
if (origins.some((v) => v === "*" || !/^https?:\/\/[^/]+$/.test(v)))
  throw new Error(
    "CORS_ORIGINS must contain explicit origins without trailing slashes",
  );
