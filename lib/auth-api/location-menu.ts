import { authApiJson } from "./client";
import type { LocationPublicExport } from "@/lib/data/location-public-export";
import type {
  GlobalMenuResponse,
  LocationMenuItemsResponse,
  PatchLocationMenuItemEnabledInput,
  PatchLocationMenuItemEnabledResponse,
  PatchLocationMenuItemsInput,
  PatchLocationMenuItemsResponse,
  PutLocationMenuItemsInput,
  PutLocationMenuItemsResponse,
} from "./types";

export type ExportPatchChangeInput = {
  menuItemId: string;
  nextEnabled: boolean;
};

export type PatchLocationMenuExportInput = {
  snapshot: LocationPublicExport;
  changes: ExportPatchChangeInput[];
  publicBaseUrl?: string;
};

export type PatchLocationMenuExportResponse = {
  export: LocationPublicExport;
};

export async function patchLocationMenuExportWithAuthServer(
  accessToken: string,
  locationId: string,
  input: PatchLocationMenuExportInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: PatchLocationMenuExportResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<PatchLocationMenuExportResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/menu/export-from-patch`,
    method: "POST",
    accessToken,
    restaurantId,
    body: input,
    timeoutMs: 30_000,
  });
}

export async function getLocationMenuWithAuthServer(
  accessToken: string,
  locationId: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: GlobalMenuResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<GlobalMenuResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/menu`,
    method: "GET",
    accessToken,
    restaurantId,
    timeoutMs: 30_000,
  });
}

export async function getLocationMenuItemsWithAuthServer(
  accessToken: string,
  locationId: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: LocationMenuItemsResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<LocationMenuItemsResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/menu-items`,
    method: "GET",
    accessToken,
    restaurantId,
    timeoutMs: 30_000,
  });
}

export async function patchLocationMenuItemEnabledWithAuthServer(
  accessToken: string,
  locationId: string,
  menuItemId: string,
  input: PatchLocationMenuItemEnabledInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: PatchLocationMenuItemEnabledResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<PatchLocationMenuItemEnabledResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/menu-items/${encodeURIComponent(menuItemId)}`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
    timeoutMs: 30_000,
  });
}

export async function publishLocationMenuItemsWithAuthServer(
  accessToken: string,
  locationId: string,
  input: PutLocationMenuItemsInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: PutLocationMenuItemsResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<PutLocationMenuItemsResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/menu-items`,
    method: "PUT",
    accessToken,
    restaurantId,
    body: input,
    timeoutMs: 60_000,
  });
}

export async function patchLocationMenuItemsWithAuthServer(
  accessToken: string,
  locationId: string,
  input: PatchLocationMenuItemsInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: PatchLocationMenuItemsResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<PatchLocationMenuItemsResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/menu-items`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
    timeoutMs: 60_000,
  });
}
