import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import api from "@/lib/axios";
import { setAccessToken } from "@/lib/auth-token";

type LoginPayload = {
  email: string;
  password: string;
};

type User = {
  id: string;
  email: string;
  username: string;
  name?: string | null;
  dob?: string;
  emailVerified: boolean;
  image?: string | null;
};

type LoginResponse = {
  user: User;
  accessToken: string;
};

const getErrorMessage = (err: unknown, fallback: string) => {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
};

export const useLogin = () =>
  useMutation<LoginResponse, Error, LoginPayload>({
    mutationKey: ["login"],
    mutationFn: async (payload) => {
      try {
        const { data } = await api.post<LoginResponse>(
          "/api/auth/login",
          payload,
        );
        if (data.accessToken) {
          setAccessToken(data.accessToken);
        }
        return data;
      } catch (err) {
        throw new Error(getErrorMessage(err, "Login failed"));
      }
    },
  });
