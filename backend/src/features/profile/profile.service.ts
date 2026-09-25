import { db } from "../../core/db/client";

export class notFoundError extends Error {
  status = 404;
  constructor(m: string) {
    super(m);
  }
}

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  followerCount: number;
  followingCount: number;
  isOwner: boolean;
};

export type PrivateProfile = PublicProfile & {
  email: string;
  dob: string | null;
  emailVerified: boolean;
};

export async function getProfileByUsername(
  username: string,
  viewerId?: string | null,
): Promise<PublicProfile | PrivateProfile> {
  const user = await db.user.findUnique({
    where: { username },
    include: { profile: true },
  });

  if (!user || !user?.username) {
    throw new notFoundError(`Profile @${username} not found`);
  }

  const isOwner = !!viewerId && viewerId === user.id;
  return isOwner
    ? {
        id: user.id,
        username: user.username!,
        displayName: user.username!,
        bio: user.profile?.bio ?? null,
        avatarUrl: user.cloudinarySecureUrl ?? user.image ?? null,
        createdAt: user.createdAt,
        followerCount: 0,
        followingCount: 0,
        isOwner: true,
        email: user.email,
        dob: user.dob ?? null,
        emailVerified: user.emailVerified,
      }
    : {
        id: user.id,
        username: user.username!,
        displayName: user.username!,
        bio: user.profile?.bio ?? null,
        avatarUrl: user.cloudinarySecureUrl ?? user.image ?? null,
        createdAt: user.createdAt,
        followerCount: 0,
        followingCount: 0,
        isOwner: false,
      };
}
