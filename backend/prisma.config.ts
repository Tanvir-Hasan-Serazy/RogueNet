import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "src/core/db/prisma",
  migrations: {
    path: "src/core/db/prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
