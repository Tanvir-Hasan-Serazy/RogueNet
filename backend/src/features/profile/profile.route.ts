import { type Application } from "express";

import { getProfileByUsernameHandler } from "./profile.controller";

export const registerProfileRoutes = (app: Application): void => {
  app.get("/api/profiles/:username", getProfileByUsernameHandler);
};

// keep singular alias for backward-compat if already deployed
export const registerProfileRoute = registerProfileRoutes;
