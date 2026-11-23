import { db } from "../../core/db/client";
import { notFoundError } from "../profile/profile.service";

export class BadRequestError extends Error {
  status = 400;
  constructor(m: string) {
    super(m);
  }
}

export type FollowResult = {
  followerId: string;
  followingId: string;
  alreadyFollowing: boolean;
};

/* Follow a user by their username.
 * Ensures self-follow is rejected and the operation is idempotent.
 */

export const follower = async (
  followerId: string,
  targetUsername: string,
): Promise<FollowResult> => {
  const targetUser = await db.user.findUnique({
    where: { username: targetUsername },
    select: { id: true, username: true },
  });

  if (!targetUser) {
    throw new notFoundError(` User @${targetUsername} not found`);
  }

  if (followerId === targetUser.id) {
    throw new BadRequestError("You cannot follow yourself");
  }

  const existingFollow = await db.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId: targetUser.id,
      },
    },
  });

  if (existingFollow) {
    return {
      followerId,
      followingId: targetUser.id,
      alreadyFollowing: true,
    };
  }

  const follow = await db.follow.create({
    data: {
      followerId,
      followingId: targetUser.id,
    },
  });

  return {
    followerId: follow.followerId,
    followingId: follow.followingId,
    alreadyFollowing: false,
  };
};
