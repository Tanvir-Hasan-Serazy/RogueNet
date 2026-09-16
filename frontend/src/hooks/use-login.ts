import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

type LoginPayload = {
  email: string;
  password: string;
};

export const useLogin = () =>
  useMutation<
    Awaited<ReturnType<typeof authClient.signIn.email>>,
    Error,
    LoginPayload
  >({
    mutationKey: ["login"],
    mutationFn: async (payload) => {
      const { data, error } = await authClient.signIn.email(payload);
      if (error) {
        throw new Error(error.message || "Login failed");
      }
      return data;
    },
  });
