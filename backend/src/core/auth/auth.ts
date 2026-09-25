import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { env } from "../config/env";
import { db } from "../db/client";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.FRONTEND_URL],
  account: {
    storeStateStrategy: "cookie",
    accountLinking: {
      enabled: true,
      trustedProviders: ["github", "google"],
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: true,
      },
      lastName: {
        type: "string",
        required: true,
      },
      username: {
        type: "string",
        required: false,
        unique: true,
      },
      dob: {
        type: "string",
        required: false,
      },
    },
  },
  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  },
});
