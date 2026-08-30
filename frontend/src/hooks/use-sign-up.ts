import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import api from "@/lib/axios";

type SignUpPayload = {
  username: string;
  email: string;
  password: string;
  confirmPassword?: string;
  dob: string;
};

type User = {
  id: string;
  email: string;
  username: string;
  name?: string | null;
  dob: string;
  emailVerified: boolean;
};

type RegisterResponse = {
  user: User;
  message?: string;
  accessToken?: string;
};

const getErrorMessage = (err: unknown, fallback: string) => {
  if (isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; error?: string; errors?: unknown }
      | undefined;
    return data?.message || data?.error || err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
};

export const useSignup = () =>
  useMutation<RegisterResponse, Error, SignUpPayload>({
    mutationKey: ["signUp"],
    mutationFn: async (payload) => {
      try {
        // Backend expects: username, email, password, dob
        const body = {
          username: payload.username,
          email: payload.email,
          password: payload.password,
          dob: payload.dob,
        };
        const { data } = await api.post<RegisterResponse>(
          "/api/auth/register",
          body,
        );
        return data;
      } catch (err) {
        throw new Error(getErrorMessage(err, "Registration failed"));
      }
    },
  });
