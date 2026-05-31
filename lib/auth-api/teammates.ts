import { authApiJson, authApiVoid } from "./client";
import type {
  CreateTeammateInput,
  CreateTeammateResponse,
  MyRestaurantsResponse,
  RevealTemporaryPasswordResponse,
  TeammatesResponse,
} from "./types";

export async function getMyRestaurantsWithAuthServer(
  accessToken: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: MyRestaurantsResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<MyRestaurantsResponse>({
    path: "/api/auth/me/restaurants",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function getTeammatesWithAuthServer(
  accessToken: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: TeammatesResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<TeammatesResponse>({
    path: "/api/auth/me/teammates",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function createTeammateWithAuthServer(
  accessToken: string,
  input: CreateTeammateInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: CreateTeammateResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<CreateTeammateResponse>({
    path: "/api/auth/me/teammates",
    method: "POST",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function revealTemporaryPasswordWithAuthServer(
  accessToken: string,
  teammateId: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: RevealTemporaryPasswordResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<RevealTemporaryPasswordResponse>({
    path: `/api/auth/me/teammates/${encodeURIComponent(teammateId)}/temporary-password`,
    method: "POST",
    accessToken,
    restaurantId,
  });
}

export async function deleteTeammateWithAuthServer(
  accessToken: string,
  teammateId: string,
  restaurantId?: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message?: string }> {
  return authApiVoid({
    path: `/api/auth/me/teammates/${encodeURIComponent(teammateId)}`,
    method: "DELETE",
    accessToken,
    restaurantId,
  });
}
