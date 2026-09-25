import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../core/auth/auth";
import { usernameParamSchema } from "./profile.schema";
import { getProfileByUsername, notFoundError } from "./profile.service";

export const getProfileByUsernameHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = usernameParamSchema.safeParse(req.params.username);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const hasFieldErrors = Object.keys(flat.fieldErrors).length > 0;
    return res.status(400).json({
      message: "Validation failed",
      errors: hasFieldErrors ? flat.fieldErrors : { username: flat.formErrors },
    });
  }

  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  const viewerId = session?.user?.id ?? null; // null = Anonymous / Stranger

  try {
    const profile = await getProfileByUsername(parsed.data, viewerId);
    return res.json(profile);
  } catch (error) {
    if (error instanceof notFoundError) {
      return res.status(error.status).json({ message: error.message });
    }

    return next(error);
  }
};
