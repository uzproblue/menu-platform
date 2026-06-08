import { getCloudflareContext } from "@opennextjs/cloudflare";

const SQL_API = "https://api.cloudflare.com/client/v4/accounts";

export type AnalyticsSqlRow = Record<string, string | number | null>;

type SqlApiResponse = {
  success?: boolean;
  errors?: Array<{ message: string }>;
  result?: {
    data?: AnalyticsSqlRow[];
    meta?: Array<{ name: string; type: string }>;
    rows?: number;
  };
};

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

export async function queryAnalyticsEngine(sql: string): Promise<AnalyticsSqlRow[]> {
  let accountId: string | undefined;
  let token: string | undefined;

  try {
    const { env } = getCloudflareContext();
    accountId = env.CF_ACCOUNT_ID?.trim();
    token = env.CF_ANALYTICS_API_TOKEN?.trim();
  } catch {
    accountId = process.env.CF_ACCOUNT_ID?.trim();
    token = process.env.CF_ANALYTICS_API_TOKEN?.trim();
  }

  if (!accountId || !token) {
    return [];
  }

  const res = await fetch(`${SQL_API}/${accountId}/analytics_engine/sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: sql,
  });

  if (!res.ok) {
    console.error("[analytics] SQL API HTTP error", res.status);
    return [];
  }

  const json = (await res.json()) as SqlApiResponse;
  if (!json.success) {
    console.error("[analytics] SQL API error", json.errors);
    return [];
  }

  return json.result?.data ?? [];
}

export function restaurantFilter(restaurantId: string | null): string {
  if (!restaurantId) return "blob3 = 'none'";
  return `blob3 = '${escapeSqlString(restaurantId)}'`;
}
