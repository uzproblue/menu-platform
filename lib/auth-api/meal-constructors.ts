import { authApiJson, authApiVoid } from "./client";
import type {
  MealConstructorMutationBody,
  MealConstructorResponse,
  MealConstructorsListResponse,
} from "./types/meal-constructors";

export async function listMealConstructorsWithAuthServer(
  accessToken: string,
  restaurantId?: string,
) {
  return authApiJson<MealConstructorsListResponse>({
    path: "/api/meal-constructors",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function getMealConstructorWithAuthServer(
  accessToken: string,
  constructorId: string,
  restaurantId?: string,
) {
  return authApiJson<MealConstructorResponse>({
    path: `/api/meal-constructors/${encodeURIComponent(constructorId)}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function createMealConstructorWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  body: MealConstructorMutationBody,
) {
  return authApiJson<MealConstructorResponse>({
    path: "/api/meal-constructors",
    method: "POST",
    accessToken,
    restaurantId,
    body,
  });
}

export async function updateMealConstructorWithAuthServer(
  accessToken: string,
  constructorId: string,
  restaurantId: string | undefined,
  body: MealConstructorMutationBody,
) {
  return authApiJson<MealConstructorResponse>({
    path: `/api/meal-constructors/${encodeURIComponent(constructorId)}`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body,
  });
}

export async function deleteMealConstructorWithAuthServer(
  accessToken: string,
  constructorId: string,
  restaurantId?: string,
) {
  return authApiVoid({
    path: `/api/meal-constructors/${encodeURIComponent(constructorId)}`,
    method: "DELETE",
    accessToken,
    restaurantId,
  });
}
