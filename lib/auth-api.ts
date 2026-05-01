/**
 * Server-side calls to menu-server auth (see AUTH_API_BASE_URL in .env).
 */
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

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  coverPhoto?: string | null;
  sortOrder: number;
  itemsCount: number;
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
};

export type GlobalMenuCategoryWithItemsApi = {
  id: string;
  name: string;
  sortOrder: number;
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
  logoUrl?: string;
  address?: string;
};

export type CreateLocationResponse = {
  location: {
    id: string;
    name: string;
    currency: string;
    logoUrl: string;
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
};

export type UpdateLocationDetailsResponse = {
  location: {
    id: string;
    name: string;
    currency: string;
    address: string;
    logoUrl: string;
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

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

function getAuthApiBaseUrl(): string | null {
  const base = process.env.AUTH_API_BASE_URL?.trim();
  return base?.length ? base.replace(/\/$/, "") : null;
}

export async function loginWithAuthServer(
  email: string,
  password: string,
): Promise<LoginResponse | null> {
  const base = getAuthApiBaseUrl();
  if (!base) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[auth] Set AUTH_API_BASE_URL (e.g. http://127.0.0.1:4000) to use menu-server",
      );
    }
    return null;
  }

  const url = `${base}/api/auth/login`;
  try {
    const res = await fetch(url, {
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

export async function updateProfileNameWithAuthServer(
  accessToken: string,
  name: string,
): Promise<
  | { ok: true; data: UpdateProfileNameResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/auth/me`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/auth/me/password`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/auth/me/teammates`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/auth/me/teammates`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/auth/me/teammates/${encodeURIComponent(teammateId)}/temporary-password`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/auth/me/teammates/${encodeURIComponent(teammateId)}`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/categories`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/global-menu`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/menu-items`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/menu-items/${encodeURIComponent(itemId)}/activation`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/menu-items/${encodeURIComponent(itemId)}`;
  try {
    const res = await fetch(url, {
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

export async function deleteMenuItemWithAuthServer(
  accessToken: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message?: string }> {
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/menu-items/${encodeURIComponent(itemId)}`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/categories`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/categories/${encodeURIComponent(categoryId)}`;
  try {
    const res = await fetch(url, {
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

export async function deleteCategoryWithAuthServer(
  accessToken: string,
  categoryId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message?: string }> {
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/categories/${encodeURIComponent(categoryId)}`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/locations`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/locations`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/locations/${encodeURIComponent(locationId)}`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/locations/${encodeURIComponent(locationId)}/menu`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/locations/${encodeURIComponent(locationId)}`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/locations/${encodeURIComponent(locationId)}`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/locations/${encodeURIComponent(locationId)}/activation`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/locations/${encodeURIComponent(locationId)}/categories`;
  try {
    const res = await fetch(url, {
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
  const base = getAuthApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "auth_api_unavailable",
      message: "AUTH_API_BASE_URL is not configured",
    };
  }

  const url = `${base}/api/locations/${encodeURIComponent(locationId)}/menu-items`;
  try {
    const res = await fetch(url, {
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
