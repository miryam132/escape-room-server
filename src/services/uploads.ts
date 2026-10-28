import { createHash, randomUUID } from "node:crypto";
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
  if (env.CLOUDINARY_CLOUD_NAME) {
    if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET)
      throw new AppError(503, "STORAGE_NOT_CONFIGURED", "Configure Cloudinary credentials first");
    const publicId = "room-images/" + randomUUID();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHash("sha256")
      .update(`public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`)
      .digest("hex");
    const body = new FormData();
    body.set("file", new Blob([new Uint8Array(data)], { type: "image/webp" }), "image.webp");
    body.set("public_id", publicId);
    body.set("timestamp", timestamp);
    body.set("api_key", env.CLOUDINARY_API_KEY);
    body.set("signature", signature);
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body, signal: AbortSignal.timeout(30000) },
      );
      if (!response.ok) throw new Error("Upload rejected");
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" ||
          !("secure_url" in result) || typeof result.secure_url !== "string" ||
          !("public_id" in result) || result.public_id !== publicId ||
          !result.secure_url.startsWith("https://res.cloudinary.com/"))
        throw new Error("Invalid storage response");
      return { imageKey: result.public_id, imageUrl: result.secure_url };
    } catch {
      throw new AppError(502, "UPLOAD_FAILED", "Image upload failed. Check Cloudinary configuration or retry.");
    }
  }
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
