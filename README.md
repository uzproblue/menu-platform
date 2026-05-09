This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Images (Cloudflare zone transformations)

In **production**, `next/image` uses a [custom loader](image-loader.ts) that points to **`/cdn-cgi/image/...`** on the **app** host so Cloudflare can resize and serve WebP/AVIF. Public object URLs on **`*.r2.dev`** or **`*.r2.cloudflarestorage.com`** are rewritten automatically (no env). A **custom** R2 public hostname must have `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` or `R2_PUBLIC_BASE_URL` set at **build** time—Worker runtime vars alone do not reach the client bundle.

In **`pnpm dev`**, the loader returns the original image URL (R2 or local path) because `/cdn-cgi/image/` is not available on localhost.

In the **Cloudflare dashboard**, allowlist only the origins you need (your R2 public hostname and same-origin paths). `data:` / `blob:` previews still use per-component `unoptimized` and bypass this pipeline.

## Auth redirects (login / logout) on Cloudflare

NextAuth builds redirect URLs from **`NEXTAUTH_URL`** unless **`AUTH_TRUST_HOST`** or **`VERCEL`** is set. On Workers, if `NEXTAUTH_URL` is missing or still `http://localhost:3000`, sign-in and sign-out send the browser to localhost.

**Fix for deployed menu-platform:** set **`AUTH_TRUST_HOST=true`** in the Worker environment (Wrangler vars/secrets or dashboard). That makes NextAuth use `x-forwarded-host` / `x-forwarded-proto` from Cloudflare so redirects stay on your real domain.

Optionally set **`NEXTAUTH_URL=https://your-domain.com`** (no trailing slash) as a canonical fallback. Do **not** ship production with `NEXTAUTH_URL` pointing at localhost.

## menu-server (API backend)

Server-side code calls **menu-server** via the Cloudflare **`MENU_SERVER` service binding** when running on Workers (see [`wrangler.jsonc`](wrangler.jsonc)). If the binding is missing (for example during plain `next dev`), it falls back to **`AUTH_API_BASE_URL`** over HTTP.

### Production (binding-only)

1. Deploy the **menu-server** Worker first, then **menu-platform**.
2. On the deployed **menu-platform** Worker, **omit `AUTH_API_BASE_URL`** from vars/secrets if you want all API traffic to go through the binding only.

### Local development

- **`pnpm dev`**: set `AUTH_API_BASE_URL` in `.env` (e.g. `http://127.0.0.1:4000`) so Next can reach a local menu-server over HTTP.
- **`pnpm cf:dev:paired`**: runs Wrangler with [`wrangler.jsonc`](wrangler.jsonc) and [`../menu-server/wrangler.toml`](../menu-server/wrangler.toml) so the **menu-server** Worker is attached as the `MENU_SERVER` binding (see [Cloudflare service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)).

## Public menu snapshots (R2 + CDN purge)

After location/menu changes, the platform writes `location-public/v1/{locationId}.json` to R2 and calls Cloudflare [purge by URL](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-single-file/) so edge caches refetch the object.

**Checklist if the guest app still shows old data:**

1. **Purge credentials** — Set **`CLOUDFLARE_ZONE_ID`** and **`CLOUDFLARE_API_TOKEN`** on the **menu-platform** Worker (same zone that fronts the public JSON hostname). If unset, purge is skipped (see logs: `Cloudflare CDN purge skipped`).
2. **Same URL the guest uses** — `R2_PUBLIC_BASE_URL` (platform) must match how **menu-customer** builds URLs from **`MENU_PUBLIC_BASE_URL`**: both should resolve to the same `https://…/location-public/v1/{id}.json`. If the guest uses another hostname (e.g. second CDN), set **`LOCATION_EXPORT_PURGE_EXTRA_BASES`** to a comma-separated list of origins (no path, no trailing slash); each gets the same object path purged.
3. **Manual purge** — In the Cloudflare dashboard, **Custom purge → URL** for the exact guest URL; then reload the guest app and check **`CF-Cache-Status: MISS`** on the first response.
4. **Custom cache keys / transforms** — If your zone uses cache key rules or path transforms, dashboard purge may not match; see Cloudflare’s purge docs for API options with matching headers.

API responses that sync a location now include **`locationExport.purge`** (`urls`, `purgeOk`, `skipped`, `message`) so you can confirm purge behavior from the admin network tab.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
