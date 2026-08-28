import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type Payload = {
  username: string;
  email: string;
  password: string;
  dob: string;
};

export const useSignup = () =>
  useMutation({
    mutationKey: ["signUp"],
    mutationFn: async (payload: Payload) => {
      const { data, error } = await authClient.signUp.email({
        email: payload.email,
        password: payload.password,
        name: payload.username,
        dob: payload.dob,
      });
      if (error) {
        throw new Error(error.message || error.statusText);
      }
      return data;
    },
  });
