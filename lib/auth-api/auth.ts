import {
  AUTH_API_UNAVAILABLE_MESSAGE,
  authApiFetch,
  authApiJson,
  authApiVoid,
  getAuthApiTransport,
  type ApiErrorResponse,
} from "./client";
import type {
  LoginResponse,
  ProvisionRestaurantInput,
  ProvisionRestaurantResponse,
  UpdateProfileNameResponse,
} from "./types";

const AUTH_NETWORK_ERROR = {
  ok: false as const,
  status: 503,
  error: "network_error",
  message: "Could not reach auth server",
};

export async function loginWithAuthServer(
  email: string,
  password: string,
): Promise<LoginResponse | null> {
  const transport = getAuthApiTransport();
  if (!transport) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[auth] Set MENU_SERVER (Wrangler) or AUTH_API_BASE_URL (e.g. http://127.0.0.1:4000) for menu-server",
      );
    }
    return null;
  }

  try {
    const res = await authApiFetch(transport, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as LoginResponse;
  } catch {
    return null;
  }
}

export async function provisionRestaurantWithAuthServer(
  input: ProvisionRestaurantInput,
): Promise<
  | { ok: true; data: ProvisionRestaurantResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  const transport = getAuthApiTransport();
  if (!transport) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: AUTH_API_UNAVAILABLE_MESSAGE,
    };
  }

  const body: Record<string, string> = {
    name: input.name,
    slug: input.slug,
    adminEmail: input.adminEmail,
  };
  if (input.adminName?.trim().length) {
    body.adminName = input.adminName.trim();
  }

  try {
    const res = await authApiFetch(transport, "/api/restaurants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Api-Key": input.adminApiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const data = (await res.json()) as ProvisionRestaurantResponse;
      return { ok: true, data };
    }
    let message: string | undefined;
    let error = "request_failed";
    try {
      const j = (await res.json()) as ApiErrorResponse;
      if (typeof j.error === "string") error = j.error;
      if (typeof j.message === "string") message = j.message;
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      return {
        ok: false,
        status: 401,
        error: "unauthorized",
        message: "Invalid provision API key",
      };
    }
    return { ok: false, status: res.status, error, message };
  } catch {
    return {
      ok: false,
      status: 503,
      error: "network_error",
      message: "Could not reach menu server",
    };
  }
}

export async function requestPasswordResetWithAuthServer(
  email: string,
): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string; message?: string }
> {
  const transport = getAuthApiTransport();
  if (!transport) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: AUTH_API_UNAVAILABLE_MESSAGE,
    };
  }

  try {
    const res = await authApiFetch(transport, "/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      return { ok: true };
    }
    let message: string | undefined;
    let error = "request_failed";
    try {
      const j = (await res.json()) as ApiErrorResponse;
      if (typeof j.error === "string") error = j.error;
      if (typeof j.message === "string") message = j.message;
    } catch {
      /* ignore */
    }
    return { ok: false, status: res.status, error, message };
  } catch {
    return AUTH_NETWORK_ERROR;
  }
}

export async function resetPasswordWithAuthServer(
  token: string,
  newPassword: string,
): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string; message?: string }
> {
  const transport = getAuthApiTransport();
  if (!transport) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: AUTH_API_UNAVAILABLE_MESSAGE,
    };
  }

  try {
    const res = await authApiFetch(transport, "/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 204) {
      return { ok: true };
    }
    let message: string | undefined;
    let error = "request_failed";
    try {
      const j = (await res.json()) as ApiErrorResponse;
      if (typeof j.error === "string") error = j.error;
      if (typeof j.message === "string") message = j.message;
    } catch {
      /* ignore */
    }
    return { ok: false, status: res.status, error, message };
  } catch {
    return AUTH_NETWORK_ERROR;
  }
}

export async function updateProfileNameWithAuthServer(
  accessToken: string,
  name: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: UpdateProfileNameResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<UpdateProfileNameResponse>({
    path: "/api/auth/me",
    method: "PATCH",
    accessToken,
    restaurantId,
    body: { name },
  });
}

export async function updatePasswordWithAuthServer(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
  restaurantId?: string,
): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiVoid({
    path: "/api/auth/me/password",
    method: "PATCH",
    accessToken,
    restaurantId,
    body: { currentPassword, newPassword },
  });
}
