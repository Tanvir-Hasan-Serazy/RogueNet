import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

type SignUpPayload = {
  username: string;
  email: string;
  password: string;
  confirmPassword?: string;
  dob: string;
};

export const useSignup = () =>
  useMutation<
    Awaited<ReturnType<typeof authClient.signUp.email>>,
    Error,
    SignUpPayload
  >({
    mutationKey: ["signUp"],
    mutationFn: async (payload) => {
      const { data, error } = await authClient.signUp.email({
        email: payload.email,
        password: payload.password,
        name: payload.username,
        username: payload.username,
        dob: payload.dob,
      } as Parameters<typeof authClient.signUp.email>[0] &
        Pick<SignUpPayload, "username" | "dob">);
      if (error) {
        throw new Error(error.message || "Registration failed");
      }
      return data;
    },
  });
