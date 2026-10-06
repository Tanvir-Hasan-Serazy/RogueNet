import { type Application } from "express";

import {
  getProfileByUsernameHandler,
  updateProfileByUsernameHandler,
} from "./profile.controller";
import { avatarUploadSingle } from "../../core/media/avatarUpload";

export const registerProfileRoutes = (app: Application): void => {
  app.get("/api/profiles/:username", getProfileByUsernameHandler);
  app.patch(
    "/api/profiles/:username",
    avatarUploadSingle,
    updateProfileByUsernameHandler,
  );
};
