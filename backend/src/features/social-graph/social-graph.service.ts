import { db } from "../../core/db/client";
import { BadRequestError } from "@/core/errors/bad-request-error";
import { NotFoundError } from "@/core/errors/not-found-error";

export type FollowResult = {
  followerId: string;
  followingId: string;
  alreadyFollowing: boolean;
};

export async function followUser(
  followerId: string,
  targetUsername: string,
): Promise<FollowResult> {
  const target = await db.user.findUnique({
    where: { username: targetUsername },
    select: { id: true },
  });

  if (!target) {
    throw new NotFoundError(`User @${targetUsername} not found`);
  }

  if (target.id === followerId) {
    throw new BadRequestError(`You cannot follow yourself`);
  }

  try {
    await db.follow.create({
      data: { followerId: followerId, followingId: target.id },
    });

    return {
      followerId: followerId,
      followingId: target.id,
      alreadyFollowing: false,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        followerId: followerId,
        followingId: target.id,
        alreadyFollowing: true,
      };
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
