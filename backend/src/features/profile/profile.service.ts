import { db } from "../../core/db/client";
import {
  uploadAvatarBuffer,
  type AvatarFile,
} from "../../core/media/avatarUpload";

export class NotFoundError extends Error {
  status = 404;
  constructor(m: string) {
    super(m);
  }
}

// Back-compat alias (existing controller imports the old name).
export { NotFoundError as notFoundError };

export class ForbiddenError extends Error {
  status = 403;
  constructor(m = "Forbidden") {
    super(m);
  }
}

export class ConflictError extends Error {
  status = 409;
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

export type UpdateProfileData = {
  username?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  displayName?: string | null;
};

type UserWithProfile = {
  profile: {
    avatarUrl: string | null;
    displayName: string | null;
    bio: string | null;
  } | null;
  cloudinarySecureUrl: string | null;
  image: string | null;
  name: string;
  username: string | null;
};

function toPublicFields(user: UserWithProfile) {
  // Canonical avatar: Profile first, then legacy User columns (OAuth fallback).
  const avatarUrl =
    user.profile?.avatarUrl ?? user.cloudinarySecureUrl ?? user.image ?? null;
  const displayName =
    user.profile?.displayName ?? user.name ?? user.username ?? "";
  return { avatarUrl, displayName };
}

export async function getProfileByUsername(
  username: string,
  viewerId?: string | null,
): Promise<PublicProfile | PrivateProfile> {
  const user = await db.user.findUnique({
    where: { username },
    include: { profile: true },
  });

  if (!user || !user.username) {
    throw new NotFoundError(`Profile @${username} not found`);
  }

  const { avatarUrl, displayName } = toPublicFields(user);
  const isOwner = !!viewerId && viewerId === user.id;
  const base = {
    id: user.id,
    username: user.username,
    displayName,
    bio: user.profile?.bio ?? null,
    avatarUrl,
    createdAt: user.createdAt,
    followerCount: 0,
    followingCount: 0,
  };

  return isOwner
    ? {
        ...base,
        isOwner: true as const,
        email: user.email,
        dob: user.dob ?? null,
        emailVerified: user.emailVerified,
      }
    : { ...base, isOwner: false as const };
}

export async function updateProfileByUsername(
  currentUsername: string,
  viewerId: string,
  data: UpdateProfileData,
  avatarFile?: AvatarFile | null,
): Promise<PublicProfile | PrivateProfile> {
  const user = await db.user.findUnique({
    where: { username: currentUsername },
    include: { profile: true },
  });

  if (!user || !user.username) {
    throw new NotFoundError(`Profile @${currentUsername} not found`);
  }

  if (viewerId !== user.id) {
    throw new ForbiddenError("You can only edit your own profile");
  }

  // Backend owns the upload: file buffer -> Cloudinary -> secure URL.
  // An explicit file always wins over a plain `avatarUrl` string.
  let resolvedAvatarUrl: string | null | undefined;
  if (avatarFile) {
    const uploaded = await uploadAvatarBuffer(avatarFile, user.id);
    resolvedAvatarUrl = uploaded.secureUrl;
  } else if (data.avatarUrl !== undefined) {
    resolvedAvatarUrl = data.avatarUrl;
  }

  const wantsProfileWrite =
    data.bio !== undefined ||
    data.displayName !== undefined ||
    resolvedAvatarUrl !== undefined;

  const wantsUsernameChange = data.username !== undefined;

  // No-op update (empty body): skip the write and return current profile.
  // Prisma rejects `update` with empty `data`, so don't call it.
  if (!wantsUsernameChange && !wantsProfileWrite) {
    return getProfileByUsername(currentUsername, viewerId);
  }

  try {
    await db.user.update({
      // Update by stable id so a username rename still matches.
      where: { id: user.id },
      data: {
        ...(data.username !== undefined && { username: data.username }),
        // Mirror the canonical Profile avatar onto User so better-auth
        // sessions (`user.image`) stay in sync with the profile page.
        ...(resolvedAvatarUrl !== undefined && {
          image: resolvedAvatarUrl,
          cloudinarySecureUrl: resolvedAvatarUrl,
        }),
        ...(wantsProfileWrite && {
          profile: {
            upsert: {
              create: {
                bio: data.bio ?? null,
                displayName: data.displayName ?? null,
                avatarUrl: resolvedAvatarUrl ?? null,
              },
              update: {
                ...(data.bio !== undefined && { bio: data.bio }),
                ...(data.displayName !== undefined && {
                  displayName: data.displayName,
                }),
                ...(resolvedAvatarUrl !== undefined && {
                  avatarUrl: resolvedAvatarUrl,
                }),
              },
            },
          },
        }),
      },
    });

    return getProfileByUsername(data.username ?? currentUsername, viewerId);
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code === "P2002") {
      throw new ConflictError(`Username @${data.username} is already taken`);
    }
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint failed on the fields")
    ) {
      throw new ConflictError(`Username @${data.username} is already taken`);
    }
    throw error;
  }
}
