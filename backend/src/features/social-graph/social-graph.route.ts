import type { Application } from "express";
import {
  followUserHandler,
  unfollowUserHandler,
} from "./social-graph.controller";

export const registerSocialGraphRoutes = (app: Application): void => {
  app.post("/api/profiles/:username/follow", followUserHandler);
  app.delete("/api/profiles/:username/follow", unfollowUserHandler);
};
