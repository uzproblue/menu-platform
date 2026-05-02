This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## menu-server (API backend)

Server-side code calls **menu-server** via the Cloudflare **`MENU_SERVER` service binding** when running on Workers (see [`wrangler.jsonc`](wrangler.jsonc)). If the binding is missing (for example during plain `next dev`), it falls back to **`AUTH_API_BASE_URL`** over HTTP.

### Production (binding-only)

1. Deploy the **menu-server** Worker first, then **menu-platform**.
2. On the deployed **menu-platform** Worker, **omit `AUTH_API_BASE_URL`** from vars/secrets if you want all API traffic to go through the binding only.

### Local development

- **`pnpm dev`**: set `AUTH_API_BASE_URL` in `.env` (e.g. `http://127.0.0.1:4000`) so Next can reach a local menu-server over HTTP.
- **`pnpm cf:dev:paired`**: runs Wrangler with [`wrangler.jsonc`](wrangler.jsonc) and [`../menu-server/wrangler.toml`](../menu-server/wrangler.toml) so the **menu-server** Worker is attached as the `MENU_SERVER` binding (see [Cloudflare service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)).

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
