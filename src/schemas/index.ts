import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) => text(max).nullable();
export const idSchema = z.string().uuid();
export const registerSchema = z
  .object({
    name: text(100),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z
      .string()
      .min(10)
      .max(72)
      .refine(
        (v) => Buffer.byteLength(v, "utf8") <= 72,
        "Password must be at most 72 UTF-8 bytes",
      ),
  })
  .strict();
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const roomSchema = z
  .object({
    title: text(150),
    description: text(5000),
    category: text(80),
    difficulty: z.enum(["easy", "medium", "hard"]),
    imageUrl: z
      .url()
      .max(2048)
      .refine(
        (v) => v.startsWith("https://") || v.startsWith("http://localhost:"),
        "Use HTTPS",
      ),
    imageKey: nullableText(300).optional(),
  })
  .strict();
export const roomPatchSchema = roomSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field");
export const hotspotSchema = z
  .object({
    label: text(150),
    xpercent: z.number().min(0).max(100),
    ypercent: z.number().min(0).max(100),
    type: z.enum(["INFO", "PUZZLE"]),
    content: z.string().max(10000),
    question: nullableText(3000).optional(),
    answerType: z.enum(["text", "number"]).nullable().optional(),
    answer: nullableText(200).optional(),
    hint: nullableText(3000).optional(),
    solvedContent: nullableText(10000).optional(),
    prerequisiteId: idSchema.nullable().optional(),
    lockedMessage: nullableText(1000).optional(),
    isFinal: z.boolean().default(false),
  })
  .strict();
export const hotspotPatchSchema = hotspotSchema
  .partial()
  .extend({ isFinal: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field");
export const answerSchema = z
  .object({ answer: text(200), revision: z.number().int().positive() })
  .strict();
export const revisionSchema = z
  .object({ revision: z.number().int().positive() })
  .strict();
export const listSchema = z
  .object({
    search: z.string().max(150).optional(),
    category: z.string().max(80).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    sort: z.enum(["newest", "oldest", "title", "difficulty"]).default("newest"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type HotspotInput = z.infer<typeof hotspotSchema>;
