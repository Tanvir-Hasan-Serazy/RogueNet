import { env } from "./core/config/env";
import cors from "cors";
import express from "express";

const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.get("/api", (req, res) => {
  res.json({ message: "Hello" });
});

app.listen(env.PORT, () => {
  console.log(`App is listening on port ${env.PORT}`);
});
