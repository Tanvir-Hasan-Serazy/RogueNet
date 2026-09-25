import { z } from "zod";
export const usernameParamSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/);

export const bioSchema = z.string().trim().max(160).nullable().optional();
export const avatarUrlSchema = z
  .url()
  .startsWith("https://res.cloudinary.com/")
  .nullable()
  .optional();
