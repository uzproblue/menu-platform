import { authApiJson, authApiVoid } from "./client";
import type {
  CreateLocationInput,
  CreateLocationResponse,
  GetLocationResponse,
  LocationDiningTablesResponse,
  LocationsResponse,
  UpdateDiningTableChoicesInput,
  UpdateLocationActivationResponse,
  UpdateLocationCategoriesResponse,
  UpdateLocationDetailsInput,
  UpdateLocationDetailsResponse,
} from "./types";

export async function getLocationsWithAuthServer(
  accessToken: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: LocationsResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<LocationsResponse>({
    path: "/api/locations",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function createLocationWithAuthServer(
  accessToken: string,
  input: CreateLocationInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: CreateLocationResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<CreateLocationResponse>({
    path: "/api/locations",
    method: "POST",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function getLocationWithAuthServer(
  accessToken: string,
  locationId: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: GetLocationResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<GetLocationResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function getLocationDiningTablesWithAuthServer(
  accessToken: string,
  locationId: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: LocationDiningTablesResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<LocationDiningTablesResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/dining-tables`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function patchLocationDiningTableChoicesWithAuthServer(
  accessToken: string,
  locationId: string,
  input: UpdateDiningTableChoicesInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: LocationDiningTablesResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<LocationDiningTablesResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/dining-tables/choices`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function updateLocationDetailsWithAuthServer(
  accessToken: string,
  locationId: string,
  input: UpdateLocationDetailsInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: UpdateLocationDetailsResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<UpdateLocationDetailsResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function deleteLocationWithAuthServer(
  accessToken: string,
  locationId: string,
  restaurantId?: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message?: string }> {
  return authApiVoid({
    path: `/api/locations/${encodeURIComponent(locationId)}`,
    method: "DELETE",
    accessToken,
    restaurantId,
  });
}

export async function updateLocationActivationWithAuthServer(
  accessToken: string,
  locationId: string,
  input: { isActive: boolean },
  restaurantId?: string,
): Promise<
  | { ok: true; data: UpdateLocationActivationResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<UpdateLocationActivationResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/activation`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function updateLocationCategoriesWithAuthServer(
  accessToken: string,
  locationId: string,
  input: { categoryIds: string[] },
  restaurantId?: string,
): Promise<
  | { ok: true; data: UpdateLocationCategoriesResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<UpdateLocationCategoriesResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/categories`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
  });
}
