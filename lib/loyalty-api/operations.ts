import { loyaltyApiJson } from "./client";

export type LoyaltyIncidentStatus = "open" | "resolved" | "ignored";

export type LoyaltyIncident = {
  id: string;
  guestId: string | null;
  eventId: string | null;
  queueName: string | null;
  category: string;
  severity: string;
  status: LoyaltyIncidentStatus;
  message: string;
  details: Record<string, unknown>;
  occurredAt: string;
  resolvedAt: string | null;
};

export type LoyaltyIncidentsResponse = {
  incidents: LoyaltyIncident[];
  nextBefore: number | null;
};

export type BalanceReconciliationRun = {
  id: string;
  mode: "report" | "repair";
  status: "running" | "succeeded" | "failed";
  scannedCount: number;
  mismatchCount: number;
  repairedCount: number;
  details: Record<string, unknown>;
  startedAt: number;
  finishedAt: number | null;
};

export type BalanceReconciliationResult = {
  runId: string;
  mode: "report" | "repair";
  scannedCount: number;
  mismatchCount: number;
  repairedCount: number;
};

export type EarnConfigVersion = {
  version: string;
  spendMinorPerPoint: number;
  currency: string;
  effectiveAt: string;
  createdAt?: string;
};

export type EarnConfigResponse = {
  restaurantId: string;
  configured: boolean;
  current: EarnConfigVersion | null;
  history: EarnConfigVersion[];
};

export type EarnConfigInput = {
  spendMinorPerPoint: number;
  currency: string;
  effectiveAt?: string;
};

export async function getEarnConfigWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
) {
  return loyaltyApiJson<EarnConfigResponse>({
    path: "/api/admin/loyalty-config",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function putEarnConfigWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  input: EarnConfigInput,
) {
  return loyaltyApiJson<EarnConfigVersion & { restaurantId: string }>({
    path: "/api/admin/loyalty-config",
    method: "PUT",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function listLoyaltyIncidentsWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  params: { status?: LoyaltyIncidentStatus; before?: number; limit?: number } = {},
) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.before) search.set("before", String(params.before));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return loyaltyApiJson<LoyaltyIncidentsResponse>({
    path: `/api/admin/loyalty/incidents${qs ? `?${qs}` : ""}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function updateLoyaltyIncidentWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  incidentId: string,
  status: "resolved" | "ignored",
) {
  return loyaltyApiJson<{ ok: true }>({
    path: `/api/admin/loyalty/incidents/${encodeURIComponent(incidentId)}`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: { status },
  });
}

export async function replayLoyaltyIncidentWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  incidentId: string,
) {
  return loyaltyApiJson<{ ok: true; outcome: string; alreadyReplayed?: boolean }>({
    path: `/api/admin/loyalty/incidents/${encodeURIComponent(incidentId)}/replay`,
    method: "POST",
    accessToken,
    restaurantId,
    body: {},
    timeoutMs: 30_000,
  });
}

export async function listReconciliationRunsWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
) {
  return loyaltyApiJson<{ runs: BalanceReconciliationRun[] }>({
    path: "/api/admin/loyalty/reconciliation",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function runReconciliationWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  repair: boolean,
) {
  return loyaltyApiJson<BalanceReconciliationResult>({
    path: "/api/admin/loyalty/reconciliation",
    method: "POST",
    accessToken,
    restaurantId,
    body: { repair },
    timeoutMs: 60_000,
  });
}
