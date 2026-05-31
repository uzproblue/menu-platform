import { authApiJson } from "./client";
import type {
  CreateSeasonalMenuDesignInput,
  DeleteSeasonalMenuDesignResponse,
  PatchSeasonalMenuDesignInput,
  SeasonalMenuDesignResponse,
  SeasonalMenuDesignsListResponse,
} from "./types";

export async function listSeasonalMenuDesignsWithAuthServer(
  accessToken: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: SeasonalMenuDesignsListResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<SeasonalMenuDesignsListResponse>({
    path: "/api/seasonal-menu-designs",
    method: "GET",
    accessToken,
    restaurantId,
    timeoutMs: 15_000,
  });
}

export async function createSeasonalMenuDesignWithAuthServer(
  accessToken: string,
  input: CreateSeasonalMenuDesignInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: SeasonalMenuDesignResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<SeasonalMenuDesignResponse>({
    path: "/api/seasonal-menu-designs",
    method: "POST",
    accessToken,
    restaurantId,
    body: input,
    timeoutMs: 15_000,
  });
}

export async function getSeasonalMenuDesignWithAuthServer(
  accessToken: string,
  designId: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: SeasonalMenuDesignResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<SeasonalMenuDesignResponse>({
    path: `/api/seasonal-menu-designs/${encodeURIComponent(designId)}`,
    method: "GET",
    accessToken,
    restaurantId,
    timeoutMs: 15_000,
  });
}

export async function patchSeasonalMenuDesignWithAuthServer(
  accessToken: string,
  designId: string,
  input: PatchSeasonalMenuDesignInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: SeasonalMenuDesignResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<SeasonalMenuDesignResponse>({
    path: `/api/seasonal-menu-designs/${encodeURIComponent(designId)}`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
    timeoutMs: 15_000,
  });
}

export async function deleteSeasonalMenuDesignWithAuthServer(
  accessToken: string,
  designId: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: DeleteSeasonalMenuDesignResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<DeleteSeasonalMenuDesignResponse>({
    path: `/api/seasonal-menu-designs/${encodeURIComponent(designId)}`,
    method: "DELETE",
    accessToken,
    restaurantId,
    timeoutMs: 15_000,
  });
}
