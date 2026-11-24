import type { Request, Response, NextFunction } from "express";
import { followParamSchema } from "./social-graph.schema";
import { auth } from "@/core/auth/auth";
import { fromNodeHeaders } from "better-auth/node";
import { followUser, unfollowUser } from "./social-graph.service";
import { BadRequestError } from "@/core/errors/bad-request-error";
import { NotFoundError } from "@/core/errors/not-found-error";

export const followUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = followParamSchema.safeParse({ username: req.params.username });
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid username" });
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const result = await followUser(session.user.id, parsed.data.username);
    return res.status(result.alreadyFollowing ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
};

export const unfollowUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsed = followParamSchema.safeParse({ username: req.params.username });
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid username" });
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const result = await unfollowUser(session.user.id, parsed.data.username);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
};
