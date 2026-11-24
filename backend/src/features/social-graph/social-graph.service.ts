import { db } from "../../core/db/client";
import { BadRequestError } from "@/core/errors/bad-request-error";
import { NotFoundError } from "@/core/errors/not-found-error";

export type FollowResult = {
  followerId: string;
  followingId: string;
  alreadyFollowing: boolean;
};

export type UnfollowResult = {
  followerId: string;
  followingId: string;
};

function isUniqueViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function isRecordNotFound(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  );
}

export const followUser = async (
  followerId: string,
  targetUsername: string,
): Promise<FollowResult> => {
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
};

export const unfollowUser = async (
  followerId: string,
  targetUsername: string,
): Promise<UnfollowResult> => {
  const target = await db.user.findUnique({
    where: { username: targetUsername },
    select: { id: true },
  });

  if (!target) {
    throw new NotFoundError(`User @${targetUsername} is not found`);
  }

  if (target.id === followerId) {
    throw new BadRequestError(`You cannot unfollow yourself`);
  }

  try {
    await db.follow.delete({
      where: {
        followerId_followingId: {
          followerId: followerId,
          followingId: target.id,
        },
      },
    });

    return {
      followerId: followerId,
      followingId: target.id,
    };
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new NotFoundError(
        `You are not following this user @${targetUsername}`,
      );
    }
    throw error;
  }
};
