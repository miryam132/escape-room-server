import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { AppError } from "../errors.js";
export async function sanitizeImage(buffer: Buffer) {
  try {
    const input = sharp(buffer, {
      limitInputPixels: 25000000,
      animated: false,
    });
    const meta = await input.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format || "") ||
      (meta.pages || 1) > 1
    )
      throw new Error("Unsupported image");
    return await input
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toBuffer();
  } catch {
    throw new AppError(
      400,
      "INVALID_IMAGE",
      "Use a valid, non-animated JPEG, PNG or WebP image, up to 25 megapixels",
    );
  }
}
export async function uploadImage(file: Express.Multer.File | undefined) {
  if (!file)
    throw new AppError(
      400,
      "FILE_REQUIRED",
      "Upload one image in the image field",
    );
  const data = await sanitizeImage(file.buffer);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new AppError(
      503,
      "STORAGE_NOT_CONFIGURED",
      "Configure image storage first",
    );
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const imageKey = randomUUID() + ".webp";
  const { error } = await client.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(imageKey, data, { contentType: "image/webp", upsert: false });
  if (error)
    throw new AppError(
      502,
      "UPLOAD_FAILED",
      "Image storage rejected the upload. Check bucket configuration.",
    );
  return {
    imageKey,
    imageUrl: client.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(imageKey).data.publicUrl,
  };
}
