import { env } from "./core/config/env";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";

import { auth } from "./core/auth/auth";
import { loginSchema, signUpSchema } from "./core/auth/schema";

const app = express();

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());

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
app.get("/api", (req, res) => {
  res.json({ message: "Hello" });
});

app.listen(env.PORT, () => {
  console.log(`App is listening on port ${env.PORT}`);
});
