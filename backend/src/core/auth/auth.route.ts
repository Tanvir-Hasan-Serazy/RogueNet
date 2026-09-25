import { toNodeHandler } from "better-auth/node";
import express from "express";

import { auth } from "./auth";
import { loginSchema, signUpSchema } from "./schema";

const validateAuthBody =
  (schema: typeof signUpSchema | typeof loginSchema) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }

    req.body = result.data;
    next();
  };

export const registerAuthRoutes = (app: express.Application): void => {
  app.post(
    "/api/auth/sign-up/email",
    validateAuthBody(signUpSchema),
    (req, res) => {
      const { confirmPassword: _confirmPassword, ...body } = req.body;
      req.body = body;
      void toNodeHandler(auth)(req, res);
    },
  );
  app.post(
    "/api/auth/sign-in/email",
    validateAuthBody(loginSchema),
    (req, res) => {
      void toNodeHandler(auth)(req, res);
    },
  );
  app.all("/api/auth/*splat", toNodeHandler(auth));
};
