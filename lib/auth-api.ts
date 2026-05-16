/**
 * Server-side calls to menu-server: prefer Cloudflare `MENU_SERVER` service binding,
 * else `AUTH_API_BASE_URL` for local HTTP (e.g. plain `next dev`).
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: { id: string; email: string; name: string };
};

export type UpdateProfileNameResponse = {
  id: string;
  email: string;
  name: string;
};

export type TeammatesResponse = {
  restaurantId: string;
  currentUserRole: "ADMIN" | "USER";
  teammates: Array<{
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "USER";
    lastLoginAt: string | null;
  }>;
};

export type CreateTeammateResponse = {
  teammate: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "USER";
    lastLoginAt: string | null;
  };
  temporaryPassword: string | null;
};

export type RevealTemporaryPasswordResponse = {
  temporaryPassword: string;
};

export type TranslationTextApi = {
  lang: string;
  name: string;
  description?: string | null;
};

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  coverPhoto?: string | null;
  sortOrder: number;
  itemsCount: number;
  translations: TranslationTextApi[];
};

export type CategoriesResponse = {
  restaurantId: string;
  categories: Category[];
};

export type CategoryResponse = {
  category: Category;
};

export type CatalogPriceApi = {
  id: string;
  price: string;
  currency: string;
};

/** Menu item row from GET /api/global-menu (matches menu-server JSON). */
export type GlobalMenuItemApi = {
  id: string;
  name: string;
  active: boolean;
  prices: CatalogPriceApi[];
  tags: string[];
  description?: string;
  image?: string;
  translations: TranslationTextApi[];
};

export type GlobalMenuCategoryWithItemsApi = {
  id: string;
  name: string;
  description?: string;
  coverPhoto?: string | null;
  sortOrder: number;
  translations: TranslationTextApi[];
  items: GlobalMenuItemApi[];
};

export type GlobalMenuResponse = {
  restaurantId: string;
  categories: GlobalMenuCategoryWithItemsApi[];
};

export type CatalogPriceInput = {
  price: string | number;
  currency: string;
};

export type CreateMenuItemInput = {
  categoryId: string;
  name: string;
  description?: string;
  image?: string;
  prices?: CatalogPriceInput[];
  active?: boolean;
  tags?: string[];
};

export type CreatedMenuItemApi = {
  id: string;
  categoryId: string;
  name: string;
  active: boolean;
  prices: CatalogPriceApi[];
  tags: string[];
  description?: string;
  image?: string;
  translations: TranslationTextApi[];
};

export type CreateMenuItemResponse = {
  item: CreatedMenuItemApi;
};

export type UpdateMenuItemInput = {
  name: string;
  description?: string | null;
  image?: string | null;
  price: string | number;
  currency: string;
  /** When set, menu-server moves the item to this category (same restaurant). */
  categoryId?: string;
};

export type UpdateMenuItemResponse = {
  item: CreatedMenuItemApi;
};

export type UpdateMenuItemActivationResponse = {
  item: {
    id: string;
    name: string;
    active: boolean;
  };
};

export type Location = {
  id: string;
  name: string;
  currency: string;
  address: string;
  logoUrl: string;
  translationLangs: string[];
  /** Menu category ids enabled for this location (subset of restaurant catalog). */
  enabledCategoryIds: string[];
  isDefault: boolean;
  isActive: boolean;
  categoryCount: number;
  menuItemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateLocationInput = {
  name: string;
  currency: string;
  translationLangs: string[];
  logoUrl?: string;
  address?: string;
};

export type CreateLocationResponse = {
  location: {
    id: string;
    name: string;
    currency: string;
    logoUrl: string;
    translationLangs: string[];
    isDefault: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export type LocationsResponse = {
  restaurantId: string;
  currentUserRole: "ADMIN" | "USER";
  locations: Location[];
};

export type UpdateLocationActivationResponse = {
  location: {
    id: string;
    name: string;
    isDefault: boolean;
    isActive: boolean;
  };
};

export type UpdateLocationCategoriesResponse = {
  location: {
    id: string;
    enabledCategoryIds: string[];
    updatedAt: string;
  };
};

export type GetLocationResponse = {
  location: Location;
};

export type UpdateLocationDetailsInput = {
  name?: string;
  currency?: string;
  logoUrl?: string;
  address?: string | null;
  translationLangs?: string[];
};

export type UpdateLocationDetailsResponse = {
  location: {
    id: string;
    name: string;
    currency: string;
    address: string;
    logoUrl: string;
    translationLangs: string[];
    enabledCategoryIds: string[];
    isDefault: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export type PutLocationMenuItemInput = {
  menuItemId: string;
  price: string | number;
};

export type PutLocationMenuItemsInput = {
  items: PutLocationMenuItemInput[];
};

export type PutLocationMenuItemsResponse = {
  locationId: string;
  itemCount: number;
  createdCatalogPrices: number;
};

export type PatchLocationMenuItemsInput = {
  add?: PutLocationMenuItemInput[];
  update?: PutLocationMenuItemInput[];
  remove?: string[];
};

export type PatchLocationMenuItemsResponse = {
  locationId: string;
  added: number;
  updated: number;
  removed: number;
  createdCatalogPrices: number;
};

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

const AUTH_API_UNAVAILABLE_MESSAGE =
  "menu-server is not configured (Cloudflare MENU_SERVER binding or AUTH_API_BASE_URL for local HTTP)";

/** Origin is ignored for service-binding `fetch`; only path matters. */
const SERVICE_BINDING_ORIGIN = "http://menu-server.internal";

type AuthApiTransport =
  | { mode: "service"; fetcher: Fetcher }
  | { mode: "http"; baseUrl: string };

function getAuthApiBaseUrl(): string | null {
  const base = process.env.AUTH_API_BASE_URL?.trim();
  return base?.length ? base.replace(/\/$/, "") : null;
}

function getAuthApiTransport(): AuthApiTransport | null {
  // Prefer explicit local HTTP first. `AUTH_API_BASE_URL` is opt-in (only set
  // for local dev) and never present in production, so this preserves the
  // service-binding path in deployed Workers.
  //
  // Why this order matters: plain `next dev` invokes
  // `initOpenNextCloudflareForDev()` which exposes `env.MENU_SERVER` as a
  // miniflare stub even when no real menu-server worker is running. Letting
  // that stub win silently swallows every login as a 401 because the stub
  // fetch always fails.
  const base = getAuthApiBaseUrl();
  if (base) return { mode: "http", baseUrl: base };

  try {
    const { env } = getCloudflareContext();
    const fetcher = env.MENU_SERVER;
    if (fetcher) {
      return { mode: "service", fetcher };
    }
  } catch {
    /* not in OpenNext / Workers request context */
  }
  return null;
}

async function authApiFetch(
  transport: AuthApiTransport,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const url =
    transport.mode === "http"
      ? new URL(path, `${transport.baseUrl}/`).toString()
      : `${SERVICE_BINDING_ORIGIN}${path}`;
  const request = new Request(url, init);
  if (transport.mode === "service") {
    return transport.fetcher.fetch(request);
  }
  return fetch(request);
}

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

export type ProvisionRestaurantResponse = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    subscriptionStartsAt: string | null;
    subscriptionEndsAt: string | null;
  };
  defaultLocation: {
    id: string;
    restaurantId: string;
    name: string;
    currency: string;
    isDefault: boolean;
  };
  defaultCategories: Array<{
    id: string;
    name: string;
    sortOrder: number;
  }>;
  admin: {
    email: string;
    temporaryPassword: string;
  };
};

export type ProvisionRestaurantInput = {
  adminApiKey: string;
  name: string;
  slug: string;
  adminEmail: string;
  adminName?: string | null;
};

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
    return {
      ok: false,
      status: 503,
      error: "network_error",
      message: "Could not reach auth server",
    };
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
    return {
      ok: false,
      status: 503,
      error: "network_error",
      message: "Could not reach auth server",
    };
  }
}

export async function updateProfileNameWithAuthServer(
  accessToken: string,
  name: string,
): Promise<
  | { ok: true; data: UpdateProfileNameResponse }
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
    const res = await authApiFetch(transport, `/api/auth/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return { ok: true, data: (await res.json()) as UpdateProfileNameResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function updatePasswordWithAuthServer(
  accessToken: string,
  currentPassword: string,
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
    const res = await authApiFetch(transport, `/api/auth/me/password`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function getTeammatesWithAuthServer(
  accessToken: string,
): Promise<
  | { ok: true; data: TeammatesResponse }
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
    const res = await authApiFetch(transport, `/api/auth/me/teammates`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return { ok: true, data: (await res.json()) as TeammatesResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function createTeammateWithAuthServer(
  accessToken: string,
  input: { email: string; name: string; role: "ADMIN" | "USER" },
): Promise<
  | { ok: true; data: CreateTeammateResponse }
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
    const res = await authApiFetch(transport, `/api/auth/me/teammates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return { ok: true, data: (await res.json()) as CreateTeammateResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function revealTemporaryPasswordWithAuthServer(
  accessToken: string,
  teammateId: string,
): Promise<
  | { ok: true; data: RevealTemporaryPasswordResponse }
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
    const res = await authApiFetch(transport, `/api/auth/me/teammates/${encodeURIComponent(teammateId)}/temporary-password`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return {
      ok: true,
      data: (await res.json()) as RevealTemporaryPasswordResponse,
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function deleteTeammateWithAuthServer(
  accessToken: string,
  teammateId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message?: string }> {
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
    const res = await authApiFetch(transport, `/api/auth/me/teammates/${encodeURIComponent(teammateId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function getCategoriesWithAuthServer(
  accessToken: string,
): Promise<
  | { ok: true; data: CategoriesResponse }
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
    const res = await authApiFetch(transport, `/api/categories`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }
    return { ok: true, data: (await res.json()) as CategoriesResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function getGlobalMenuWithAuthServer(
  accessToken: string,
): Promise<
  | { ok: true; data: GlobalMenuResponse }
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
    const res = await authApiFetch(transport, `/api/global-menu`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }
    return { ok: true, data: (await res.json()) as GlobalMenuResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function createMenuItemWithAuthServer(
  accessToken: string,
  input: CreateMenuItemInput,
): Promise<
  | { ok: true; data: CreateMenuItemResponse }
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
    const res = await authApiFetch(transport, `/api/menu-items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }
    return { ok: true, data: (await res.json()) as CreateMenuItemResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function updateMenuItemActivationWithAuthServer(
  accessToken: string,
  itemId: string,
  input: { isActive: boolean },
): Promise<
  | { ok: true; data: UpdateMenuItemActivationResponse }
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
    const res = await authApiFetch(transport, `/api/menu-items/${encodeURIComponent(itemId)}/activation`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }
    return { ok: true, data: (await res.json()) as UpdateMenuItemActivationResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function updateMenuItemWithAuthServer(
  accessToken: string,
  itemId: string,
  input: UpdateMenuItemInput,
): Promise<
  | { ok: true; data: UpdateMenuItemResponse }
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
    const res = await authApiFetch(transport, `/api/menu-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }
    return { ok: true, data: (await res.json()) as UpdateMenuItemResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function updateMenuItemTranslationsWithAuthServer(
  accessToken: string,
  itemId: string,
  input: { translations: TranslationTextApi[] },
): Promise<
  | { ok: true; data: UpdateMenuItemResponse }
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
    const res = await authApiFetch(
      transport,
      `/api/menu-items/${encodeURIComponent(itemId)}/translations`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(input),
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }
    return { ok: true, data: (await res.json()) as UpdateMenuItemResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function deleteMenuItemWithAuthServer(
  accessToken: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message?: string }> {
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
    const res = await authApiFetch(transport, `/api/menu-items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function createCategoryWithAuthServer(
  accessToken: string,
  input: { name: string; description?: string; coverPhoto?: string },
): Promise<
  | { ok: true; data: CategoryResponse }
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
    const res = await authApiFetch(transport, `/api/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }
    return { ok: true, data: (await res.json()) as CategoryResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function updateCategoryWithAuthServer(
  accessToken: string,
  categoryId: string,
  input: {
    name?: string;
    description?: string;
    coverPhoto?: string;
    sortOrder?: number;
  },
): Promise<
  | { ok: true; data: CategoryResponse }
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
    const res = await authApiFetch(transport, `/api/categories/${encodeURIComponent(categoryId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }
    return { ok: true, data: (await res.json()) as CategoryResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function updateCategoryTranslationsWithAuthServer(
  accessToken: string,
  categoryId: string,
  input: { translations: TranslationTextApi[] },
): Promise<
  | { ok: true; data: CategoryResponse }
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
    const res = await authApiFetch(
      transport,
      `/api/categories/${encodeURIComponent(categoryId)}/translations`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(input),
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }
    return { ok: true, data: (await res.json()) as CategoryResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function deleteCategoryWithAuthServer(
  accessToken: string,
  categoryId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message?: string }> {
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
    const res = await authApiFetch(transport, `/api/categories/${encodeURIComponent(categoryId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function getLocationsWithAuthServer(
  accessToken: string,
): Promise<
  | { ok: true; data: LocationsResponse }
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
    const res = await authApiFetch(transport, `/api/locations`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return { ok: true, data: (await res.json()) as LocationsResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function createLocationWithAuthServer(
  accessToken: string,
  input: CreateLocationInput,
): Promise<
  | { ok: true; data: CreateLocationResponse }
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
    const res = await authApiFetch(transport, `/api/locations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }
    return { ok: true, data: (await res.json()) as CreateLocationResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function getLocationWithAuthServer(
  accessToken: string,
  locationId: string,
): Promise<
  | { ok: true; data: GetLocationResponse }
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
    const res = await authApiFetch(transport, `/api/locations/${encodeURIComponent(locationId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return { ok: true, data: (await res.json()) as GetLocationResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function getLocationMenuWithAuthServer(
  accessToken: string,
  locationId: string,
): Promise<
  | { ok: true; data: GlobalMenuResponse }
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
    const res = await authApiFetch(transport, `/api/locations/${encodeURIComponent(locationId)}/menu`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return { ok: true, data: (await res.json()) as GlobalMenuResponse };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function updateLocationDetailsWithAuthServer(
  accessToken: string,
  locationId: string,
  input: UpdateLocationDetailsInput,
): Promise<
  | { ok: true; data: UpdateLocationDetailsResponse }
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
    const res = await authApiFetch(transport, `/api/locations/${encodeURIComponent(locationId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return {
      ok: true,
      data: (await res.json()) as UpdateLocationDetailsResponse,
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function deleteLocationWithAuthServer(
  accessToken: string,
  locationId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message?: string }> {
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
    const res = await authApiFetch(transport, `/api/locations/${encodeURIComponent(locationId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function updateLocationActivationWithAuthServer(
  accessToken: string,
  locationId: string,
  input: { isActive: boolean },
): Promise<
  | { ok: true; data: UpdateLocationActivationResponse }
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
    const res = await authApiFetch(transport, `/api/locations/${encodeURIComponent(locationId)}/activation`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return {
      ok: true,
      data: (await res.json()) as UpdateLocationActivationResponse,
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function updateLocationCategoriesWithAuthServer(
  accessToken: string,
  locationId: string,
  input: { categoryIds: string[] },
): Promise<
  | { ok: true; data: UpdateLocationCategoriesResponse }
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
    const res = await authApiFetch(transport, `/api/locations/${encodeURIComponent(locationId)}/categories`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return {
      ok: true,
      data: (await res.json()) as UpdateLocationCategoriesResponse,
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function publishLocationMenuItemsWithAuthServer(
  accessToken: string,
  locationId: string,
  input: PutLocationMenuItemsInput,
): Promise<
  | { ok: true; data: PutLocationMenuItemsResponse }
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
    const res = await authApiFetch(transport, `/api/locations/${encodeURIComponent(locationId)}/menu-items`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return {
      ok: true,
      data: (await res.json()) as PutLocationMenuItemsResponse,
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}

export async function patchLocationMenuItemsWithAuthServer(
  accessToken: string,
  locationId: string,
  input: PatchLocationMenuItemsInput,
): Promise<
  | { ok: true; data: PatchLocationMenuItemsResponse }
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
    const res = await authApiFetch(
      transport,
      `/api/locations/${encodeURIComponent(locationId)}/menu-items`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(input),
        cache: "no-store",
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!res.ok) {
      let payload: ApiErrorResponse | null = null;
      try {
        payload = (await res.json()) as ApiErrorResponse;
      } catch {
        payload = null;
      }
      return {
        ok: false,
        status: res.status,
        error: payload?.error ?? "request_failed",
        message: payload?.message,
      };
    }

    return {
      ok: true,
      data: (await res.json()) as PatchLocationMenuItemsResponse,
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach auth API server",
    };
  }
}
