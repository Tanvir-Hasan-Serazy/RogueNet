import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "src/core/db/prisma",
  migrations: {
    path: "src/core/db/prisma/migrations",
    seed: "tsx seed.js",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
