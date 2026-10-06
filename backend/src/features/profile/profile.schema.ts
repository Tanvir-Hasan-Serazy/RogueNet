import { z } from "zod";
export const usernameParamSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/);

export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .nullable()
  .optional();

export const bioSchema = z.string().trim().max(160).nullable().optional();
export const avatarUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || v.startsWith("https://res.cloudinary.com/"),
    "avatarUrl must be a Cloudinary URL",
  )
  .nullable()
  .optional();

// multipart/form-data text fields arrive as strings; empty string = clear.
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? null : v), schema);

export const updateProfileBodySchema = z.object({
  username: usernameParamSchema.optional(),
  bio: emptyToNull(bioSchema),
  avatarUrl: emptyToNull(avatarUrlSchema),
  displayName: emptyToNull(displayNameSchema),
});
