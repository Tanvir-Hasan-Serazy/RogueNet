/**
 * In-memory access token store.
 * Do NOT persist to localStorage — access token lives only in memory.
 * Refresh token is stored in httpOnly cookie by the backend and sent automatically via `withCredentials`.
 */

let accessToken: string | null = null;

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const clearAccessToken = (): void => {
  accessToken = null;
};
