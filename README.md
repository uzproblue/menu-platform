This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Images (R2 object keys + Cloudflare `/cdn-cgi/image/`)

- **Database** — After `POST /api/uploads/r2/file`, clients store **`objectKey`** (e.g. `menu-items/.../file.jpeg`) on menu-server for `image`, `coverPhoto`, and location `logoUrl` when the file was uploaded via the platform. Users can still paste a full `https://…` URL; the loader accepts both.
- **`next/image`** — Global custom loader [`lib/cloudflare-image-loader.ts`](lib/cloudflare-image-loader.ts): in **production** it builds  
  `{NEXT_PUBLIC_R2_PUBLIC_BASE_URL}/cdn-cgi/image/width={w},quality={q},format=auto/{objectKey}`  
  on your **public CDN** zone (enable [Image Resizing](https://developers.cloudflare.com/images/transform-images/) there). The same **`/cdn-cgi/image/...`** shape is used in **local `pnpm dev`** and in production so the browser always requests transformed URLs on the CDN host.
- **Guest JSON** — [`buildLocationPublicExport`](lib/data/location-public-export.ts) expands stored object keys to **`{R2_PUBLIC_BASE_URL}/{key}`** in the exported snapshot so anonymous apps still see full URLs.

Set **`NEXT_PUBLIC_R2_PUBLIC_BASE_URL`** (and **`R2_PUBLIC_BASE_URL`** on the server) to your public object origin (no trailing slash). Scripts use **`next dev --webpack`**.

**Cloudflare deploy:** The CDN base must be available **when `next build` runs**. This repo commits [`.env.production`](.env.production) with `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` so Workers Builds pick it up automatically (Next loads `.env.production` before compiling). You can override that value with **build** environment variables in the dashboard or CI if needed. **Runtime-only** Worker vars are not enough by themselves; they do not change the compiled browser bundle.

`data:` / `blob:` previews use per-component **`unoptimized`** (loader not used for those).

## Auth redirects (login / logout) on Cloudflare

NextAuth builds redirect URLs from **`NEXTAUTH_URL`** unless **`AUTH_TRUST_HOST`** or **`VERCEL`** is set. On Workers, if `NEXTAUTH_URL` is missing or still `http://localhost:3000`, sign-in and sign-out send the browser to localhost.

**Fix for deployed menu-platform:** set **`AUTH_TRUST_HOST=true`** in the Worker environment (Wrangler vars/secrets or dashboard). That makes NextAuth use `x-forwarded-host` / `x-forwarded-proto` from Cloudflare so redirects stay on your real domain.

Optionally set **`NEXTAUTH_URL=https://your-domain.com`** (no trailing slash) as a canonical fallback. Do **not** ship production with `NEXTAUTH_URL` pointing at localhost.

## Location menu QR (`MENU_URL`)

Set **`MENU_URL`** on the **menu-platform** Worker (Wrangler vars / dashboard) to the **menu-customer** origin with no trailing slash, e.g. `https://menu.example.com`. Each request injects it on `<body data-menu-public-base-url="…">` so QR modals use the guest app URL **without rebuilding** when you only change runtime config.

Location QR codes encode `{MENU_URL}/{locationId}/menu`.

For local `pnpm dev`, set `MENU_URL` or `NEXT_PUBLIC_MENU_URL` in `.env`. For production you can also add the same value to **Workers Builds → build environment** (or `.env.production`) so it is inlined into the client bundle; runtime `MENU_URL` alone is enough for QR after deploy.

If neither build nor runtime `MENU_URL` is set, QR falls back to `window.location.origin` (the platform host).

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

**Rapid toggles (enable/disable many items):** By default, location exports run in the background via `ctx.waitUntil` and are **coalesced** (one R2 write per location per burst). The admin UI serializes toggle PATCH requests so Workers are less likely to hit CPU/subrequest limits (Cloudflare Error 1102). Set **`LOCATION_EXPORT_STRICT=true`** only if you need the HTTP response to wait for export completion (not recommended on production Workers).

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
