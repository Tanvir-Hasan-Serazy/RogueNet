import { env } from "./core/config/env";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";

import { auth } from "./core/auth/auth";

const app = express();

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.all("/api/auth/*splat", toNodeHandler(auth));
app.get("/api", (req, res) => {
  res.json({ message: "Hello" });
});

app.listen(env.PORT, () => {
  console.log(`App is listening on port ${env.PORT}`);
});
