import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type Payload = {
  email: string;
  password: string;
};

export const useLogin = () =>
  useMutation({
    mutationKey: ["login"],
    mutationFn: async (payload: Payload) => {
      const { data, error } = await authClient.signIn.email({
        email: payload.email,
        password: payload.password,
      });
      if (error) {
        throw new Error(error.message || error.statusText);
      }
      return data;
    },
  });
