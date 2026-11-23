import { z } from "zod";
import { usernameParamSchema } from "../profile/profile.schema";

export const followParamSchema = z.object({
  username: usernameParamSchema,
});
