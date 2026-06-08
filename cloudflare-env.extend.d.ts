/** Secrets / vars not inferred by `wrangler types` — set via dashboard or `wrangler secret put`. */
declare namespace Cloudflare {
  interface Env {
    CF_ANALYTICS_API_TOKEN: string;
    CF_ACCOUNT_ID: string;
    MENU_URL: string;
    NEXT_PUBLIC_MENU_URL: string;
    BUNNY_STREAM_LIBRARY_ID: string;
    BUNNY_STREAM_API_KEY: string;
    NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID: string;
  }
}
