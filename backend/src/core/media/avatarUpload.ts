import multer from "multer";
import sharp from "sharp";
import type { Request, Response, NextFunction } from "express";
import { cloudinary } from "./cloudinary";
import { env } from "../config/env";

const MAX_AVATAR_BYTES = 15 * 1024 * 1024;
// Pre-Cloudinary target: shrink + compress locally so a 15MB phone photo
// becomes ~150-500KB on the wire / in Cloudinary storage.
const OPTIMIZED_MAX_DIM = 1024;
const OPTIMIZED_QUALITY = 80;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPEG, PNG or WebP images are allowed"));
  },
});

/** Multer middleware expecting `multipart/form-data` field `avatar`. */
export const avatarUpload = upload.single("avatar");

/** Same as `avatarUpload` but converts Multer/file-filter errors to 400 JSON. */
export function avatarUploadSingle(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  avatarUpload(req, res, (err: unknown) => {
    if (!err) return next();
    const message = err instanceof Error ? err.message : "Avatar upload failed";
    const isTooLarge =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "LIMIT_FILE_SIZE";
    res.status(400).json({
      message: isTooLarge
        ? `Avatar must be under ${MAX_AVATAR_BYTES / 1024 / 1024}MB`
        : message,
    });
  });
}

export type AvatarFile = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
};

/**
 * Shrink + recompress in backend before Cloudinary.
 * 15MB uploads stay allowed, but Cloudinary only receives a
 * <=1024px WebP (~80 quality, metadata stripped).
 */
export async function optimizeAvatarBuffer(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate() // auto-orient via EXIF
      .resize({
        width: OPTIMIZED_MAX_DIM,
        height: OPTIMIZED_MAX_DIM,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: OPTIMIZED_QUALITY, effort: 4 })
      .toBuffer();
  } catch {
    throw new Error("Invalid or corrupt image file");
  }
}

export async function uploadAvatarBuffer(
  file: AvatarFile,
  userId: string,
): Promise<{ secureUrl: string; publicId: string }> {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    throw new Error(
      "Cloudinary is not configured (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)",
    );
  }

  // Optimize locally first: less bandwidth + less Cloudinary storage.
  // Cloudinary still applies the 512 face-crop for the final avatar.
  const optimized = await optimizeAvatarBuffer(file.buffer);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "roguenet/avatars",
        public_id: `user_${userId}_${Date.now()}`,
        overwrite: false,
        resource_type: "image",
        transformation: [
          { width: 512, height: 512, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url)
          return reject(new Error("Cloudinary upload returned no URL"));
        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
        });
      },
    );
    stream.end(optimized);
  });
}
