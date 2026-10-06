import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";

// Mocks must be declared before the mocked modules are imported.
vi.mock("../core/db/client", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../core/auth/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { db } from "../core/db/client";
import { auth } from "../core/auth/auth";
import { registerProfileRoutes } from "../features/profile/profile.route";
import {
  ConflictError,
  ForbiddenError,
  getProfileByUsername,
  NotFoundError,
  updateProfileByUsername,
} from "../features/profile/profile.service";
import {
  updateProfileBodySchema,
  usernameParamSchema,
} from "../features/profile/profile.schema";

const findUnique = vi.mocked(db.user.findUnique);
const userUpdate = vi.mocked(db.user.update);
const getSession = vi.mocked(auth.api.getSession);

function buildApp() {
  const app = express();
  app.use(express.json());
  registerProfileRoutes(app);
  // Convert unexpected errors to JSON so supertest gets a body instead of HTML.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ message: err.message ?? "Internal error" });
  });
  return app;
}

const baseUser = {
  id: "user-alice",
  email: "alice@example.com",
  emailVerified: true,
  name: "Alice",
  username: "alice",
  dob: null,
  image: null,
  cloudinarySecureUrl: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  profile: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("2.5 profile validation", () => {
  it("rejects too-short, too-long, and non-word usernames", () => {
    expect(usernameParamSchema.safeParse("ab").success).toBe(false);
    expect(usernameParamSchema.safeParse("a".repeat(21)).success).toBe(false);
    expect(usernameParamSchema.safeParse("bad-name!").success).toBe(false);
    expect(usernameParamSchema.safeParse("tanvir_123").success).toBe(true);
  });

  it("rejects oversized bio and non-Cloudinary avatarUrl", () => {
    const bad = updateProfileBodySchema.safeParse({
      bio: "x".repeat(161),
      avatarUrl: "http://evil.com/x.jpg",
      username: "ab",
    });
    expect(bad.success).toBe(false);

    const good = updateProfileBodySchema.safeParse({
      bio: "hello",
      avatarUrl: "https://res.cloudinary.com/demo/image/upload/v1/a.webp",
      displayName: "Alice",
    });
    expect(good.success).toBe(true);
  });

  it("treats empty string as clear (null) for multipart text fields", () => {
    const parsed = updateProfileBodySchema.safeParse({
      bio: "",
      displayName: "",
      avatarUrl: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.bio).toBeNull();
      expect(parsed.data.displayName).toBeNull();
      expect(parsed.data.avatarUrl).toBeNull();
    }
  });

  it("GET /api/profiles/:username returns 400 for invalid param", async () => {
    const res = await request(buildApp()).get("/api/profiles/ab");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/validation/i);
  });

  it("PATCH returns 400 for invalid body when authenticated", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-alice" },
      session: { id: "sess-1" },
    } as never);
    const res = await request(buildApp())
      .patch("/api/profiles/alice")
      .send({ bio: "x".repeat(161) });
    expect(res.status).toBe(400);
  });
});

describe("2.5 duplicate username", () => {
  it("service maps Prisma P2002 to 409 ConflictError", async () => {
    findUnique.mockResolvedValue(baseUser as never);
    userUpdate.mockRejectedValue({ code: "P2002" });

    await expect(
      updateProfileByUsername("alice", "user-alice", { username: "bob" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateProfileByUsername("alice", "user-alice", { username: "bob" }).catch(
        (e: unknown) => e,
      ),
    ).resolves.toBeInstanceOf(ConflictError);
  });

  it("PATCH returns 409 when username is taken", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-alice" },
      session: { id: "sess-1" },
    } as never);
    findUnique.mockResolvedValue(baseUser as never);
    userUpdate.mockRejectedValue({ code: "P2002" });

    const res = await request(buildApp())
      .patch("/api/profiles/alice")
      .send({ username: "bob" });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already taken/);
  });
});

describe("2.5 unauthenticated / forbidden edits", () => {
  it("PATCH without session returns 401 and never touches the DB", async () => {
    getSession.mockResolvedValue(null as never);
    const res = await request(buildApp())
      .patch("/api/profiles/alice")
      .send({ bio: "hi" });
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("service rejects edits by a non-owner with 403", async () => {
    findUnique.mockResolvedValue(baseUser as never);
    await expect(
      updateProfileByUsername("alice", "user-bob", { bio: "hijack" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("PATCH by a non-owner returns 403", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-bob" },
      session: { id: "sess-2" },
    } as never);
    findUnique.mockResolvedValue(baseUser as never);

    const res = await request(buildApp())
      .patch("/api/profiles/alice")
      .send({ bio: "hijack" });
    expect(res.status).toBe(403);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("GET stays public for anonymous viewers (no private fields)", async () => {
    getSession.mockResolvedValue(null as never);
    findUnique.mockResolvedValue(baseUser as never);

    const profile = await getProfileByUsername("alice", null);
    expect(profile).toMatchObject({ username: "alice", isOwner: false });
    expect(profile).not.toHaveProperty("email");
    if (profile instanceof NotFoundError) throw profile;
  });
});
