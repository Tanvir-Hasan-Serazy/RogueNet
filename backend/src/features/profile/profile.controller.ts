import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../core/auth/auth";
import {
  usernameParamSchema,
  updateProfileBodySchema,
} from "./profile.schema";
import {
  getProfileByUsername,
  updateProfileByUsername,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "./profile.service";

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

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  const viewerId = session?.user?.id ?? null; // null = Anonymous / Stranger

  try {
    const profile = await getProfileByUsername(parsed.data, viewerId);
    return res.json(profile);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.status).json({ message: error.message });
    }

    return next(error);
  }
};

export const updateProfileByUsernameHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const param = usernameParamSchema.safeParse(req.params.username);
  if (!param.success) {
    return res.status(400).json({ message: "Invalid username" });
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Works for both JSON (`avatarUrl` string) and multipart (`avatar` file).
  const body = updateProfileBodySchema.safeParse(req.body ?? {});
  if (!body.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: body.error.flatten().fieldErrors,
    });
  }

  const file = (req as Request & { file?: Express.Multer.File }).file;

  try {
    const profile = await updateProfileByUsername(
      param.data,
      session.user.id,
      {
        ...(body.data.username !== undefined && {
          username: body.data.username,
        }),
        ...(body.data.bio !== undefined && { bio: body.data.bio }),
        ...(body.data.displayName !== undefined && {
          displayName: body.data.displayName,
        }),
        ...(body.data.avatarUrl !== undefined && {
          avatarUrl: body.data.avatarUrl,
        }),
      },
      file
        ? {
            buffer: file.buffer,
            mimetype: file.mimetype,
            originalname: file.originalname,
          }
        : null,
    );
    return res.json(profile);
  } catch (error) {
    if (
      error instanceof NotFoundError ||
      error instanceof ForbiddenError ||
      error instanceof ConflictError
    ) {
      return res.status(error.status).json({ message: error.message });
    }
    if (
      error instanceof Error &&
      /invalid|corrupt image|only jpeg|cloudinary is not configured/i.test(
        error.message,
      )
    ) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};
