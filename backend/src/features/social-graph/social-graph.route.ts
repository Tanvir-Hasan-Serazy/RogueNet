import type { Application } from "express";
import { followUserHandler } from "./social-graph.controller";

export const registerSocialGraphRoutes = (app: Application): void => {
  app.post("/api/profiles/:username/follow", followUserHandler);
};
