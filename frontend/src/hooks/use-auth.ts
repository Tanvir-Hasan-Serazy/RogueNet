import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import api from "@/lib/axios";
import { clearAccessToken, setAccessToken } from "@/lib/auth-token";

// ── Types ──────────────────────────────────────────────────────────

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  name?: string | null;
  dob?: string;
  bio?: string | null;
  image?: string | null;
  imagePublicId?: string | null;
  emailVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
};

// ── Helpers ────────────────────────────────────────────────────────

const getErrorMessage = (err: unknown, fallback: string) => {
  if (isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; error?: string }
      | undefined;
    return data?.message || data?.error || err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
};

// ── GET /api/auth/me ───────────────────────────────────────────────

export const useMe = (opts?: { enabled?: boolean }) =>
  useQuery<AuthUser, Error>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const { data } = await api.get<{ user: AuthUser } | AuthUser>(
          "/api/auth/me",
        );
        // Support both { user } and direct user shapes
        return (data as { user: AuthUser }).user ?? (data as AuthUser);
      } catch (err) {
        throw new Error(getErrorMessage(err, "Failed to fetch user"));
      }
    },
    retry: false,
    enabled: opts?.enabled ?? true,
  });

// ── POST /api/auth/refresh ─────────────────────────────────────────

export const useRefresh = () =>
  useMutation<{ accessToken: string }, Error, void>({
    mutationKey: ["refresh"],
    mutationFn: async () => {
      try {
        const { data } = await api.post<{ accessToken: string }>(
          "/api/auth/refresh",
        );
        setAccessToken(data.accessToken);
        return data;
      } catch (err) {
        clearAccessToken();
        throw new Error(getErrorMessage(err, "Session refresh failed"));
      }
    },
  });

// ── POST /api/auth/logout ──────────────────────────────────────────

export const useLogout = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationKey: ["logout"],
    mutationFn: async () => {
      try {
        await api.post("/api/auth/logout");
      } catch (err) {
        throw new Error(getErrorMessage(err, "Logout failed"));
      } finally {
        clearAccessToken();
        qc.removeQueries({ queryKey: ["me"] });
      }
    },
  });
};

export const useLogoutAll = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationKey: ["logoutAll"],
    mutationFn: async () => {
      try {
        await api.post("/api/auth/logout-all");
      } catch (err) {
        throw new Error(getErrorMessage(err, "Logout all failed"));
      } finally {
        clearAccessToken();
        qc.removeQueries({ queryKey: ["me"] });
      }
    },
  });
};

// ── POST /api/auth/verify-email ────────────────────────────────────

export const useVerifyEmail = () =>
  useMutation<{ message: string }, Error, { token: string }>({
    mutationKey: ["verifyEmail"],
    mutationFn: async ({ token }) => {
      try {
        const { data } = await api.post<{ message: string }>(
          "/api/auth/verify-email",
          { token },
        );
        return data;
      } catch (err) {
        throw new Error(getErrorMessage(err, "Email verification failed"));
      }
    },
  });

export const useResendVerification = () =>
  useMutation<{ message: string }, Error, { email: string }>({
    mutationKey: ["resendVerification"],
    mutationFn: async ({ email }) => {
      try {
        const { data } = await api.post<{ message: string }>(
          "/api/auth/resend-verification",
          { email },
        );
        return data;
      } catch (err) {
        throw new Error(getErrorMessage(err, "Resend verification failed"));
      }
    },
  });

// ── POST /api/auth/forgot-password / reset-password ────────────────

export const useForgotPassword = () =>
  useMutation<{ message: string }, Error, { email: string }>({
    mutationKey: ["forgotPassword"],
    mutationFn: async ({ email }) => {
      try {
        const { data } = await api.post<{ message: string }>(
          "/api/auth/forgot-password",
          { email },
        );
        return data;
      } catch (err) {
        throw new Error(getErrorMessage(err, "Forgot password failed"));
      }
    },
  });

export const useResetPassword = () =>
  useMutation<
    { message: string },
    Error,
    { token: string; password: string; confirmPassword: string }
  >({
    mutationKey: ["resetPassword"],
    mutationFn: async ({ token, password, confirmPassword }) => {
      try {
        const { data } = await api.post<{ message: string }>(
          "/api/auth/reset-password",
          { token, password, confirmPassword },
        );
        return data;
      } catch (err) {
        throw new Error(getErrorMessage(err, "Password reset failed"));
      }
    },
  });
