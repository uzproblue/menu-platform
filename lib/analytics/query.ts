import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const SQL_API = "https://api.cloudflare.com/client/v4/accounts";

export type AnalyticsSqlRow = Record<string, string | number | null>;

/** Direct SQL API body — see Cloudflare “Querying from a Worker” docs. */
type SqlDirectResponse = {
  meta?: Array<{ name: string; type: string }>;
  data?: AnalyticsSqlRow[];
  rows?: number;
  error?: string;
};

/** Occasional v4 envelope wrapper (not used by analytics_engine/sql in practice). */
type SqlV4Response = {
  success?: boolean;
  errors?: Array<{ message: string }> | null;
  result?: SqlDirectResponse;
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
    const body = await res.text().catch(() => "");
    console.error("[analytics] SQL API HTTP error", res.status, body.slice(0, 500));
    return [];
  }

  const json = (await res.json()) as SqlDirectResponse & SqlV4Response;

  // analytics_engine/sql returns { meta, data, rows } at the top level (no success flag).
  if (Array.isArray(json.data)) {
    return json.data;
  }

  if (json.result && Array.isArray(json.result.data)) {
    return json.result.data;
  }

  if (json.success === false) {
    console.error("[analytics] SQL API error", json.errors, "sql:", sql.slice(0, 200));
    return [];
  }

  if (typeof json.error === "string" && json.error.length > 0) {
    console.error("[analytics] SQL API error", json.error, "sql:", sql.slice(0, 200));
    return [];
  }

  console.error(
    "[analytics] SQL API unexpected response",
    JSON.stringify(json).slice(0, 500),
    "sql:",
    sql.slice(0, 200),
  );
  return [];
}

export function restaurantFilter(restaurantId: string | null): string {
  if (!restaurantId) return "blob3 = 'none'";
  return `blob3 = '${escapeSqlString(restaurantId)}'`;
}
