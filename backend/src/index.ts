import cors from "cors";
import express from "express";
import { env } from "./core/config/env";
import { registerAuthRoutes } from "./core/auth/auth.route";
import { registerProfileRoutes } from "./features/profile/profile.route";
import { registerSocialGraphRoutes } from "./features/social-graph/social-graph.route";

const app = express();

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());

registerAuthRoutes(app);
registerProfileRoutes(app);
registerSocialGraphRoutes(app);

app.get("/api", (req, res) => {
  res.json({ message: "Hello" });
});

app.listen(env.PORT, () => {
  console.log(`App is listening on port ${env.PORT}`);
});
