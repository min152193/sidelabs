# SideLabs Monorepo Structure

This repository is split into independent directories to prevent routing conflicts and enable independent Cloudflare deployments.

## Directory Structure

```
.
├── landing/          # Main 3D Card Landing Page Worker + static templates
├── blog/             # Astro Static/SSR Blog under the '/blog' subdirectory
└── email-worker/     # Isolated Worker handling 'POST /api/contact' sending
```

---

## 1. Landing Page (`/landing`)

### Overview
Serves the 3D card layout at the root (`/`) path, static styles, assets, and auth endpoints. Features a virtual scroll listener for navigation redirection to `/blog`.

### Build & Deploy
1. Navigate to `/landing`:
   ```bash
   cd landing
   ```
2. Deploy directly to Cloudflare Workers using Wrangler:
   ```bash
   npx wrangler deploy
   ```

---

## 2. Astro Blog (`/blog`)

### Overview
A static/SSR Astro blog containing technical design pages and AdSense components. Configured to live under the `/blog` base route.

### Build & Deploy
1. Navigate to `/blog`:
   ```bash
   cd blog
   ```
2. Build the static assets:
   ```bash
   npm run build
   ```
3. Deploy to Cloudflare Pages:
   ```bash
   npx wrangler pages deploy dist --project-name=sidelabs-blog
   ```

---

## 3. Email Worker (`/email-worker`)

### Overview
An isolated, serverless email API endpoint that accepts form submissions at `POST /api/contact` and relays them via the Resend API.

### Build & Deploy
1. Navigate to `/email-worker`:
   ```bash
   cd email-worker
   ```
2. Set up Resend API key secret in Cloudflare:
   ```bash
   npx wrangler secret put RESEND_API_KEY
   ```
3. Deploy the Worker:
   ```bash
   npx wrangler deploy
   ```

---

## Cloudflare Routing Strategy (Custom Domains & Routes)

To map all three parts under `sidelabs.net` cleanly without conflicting:

1. **Main Landing:**
   - Map route `sidelabs.net/*` (or root `sidelabs.net`) to the **Landing Page** worker.
   - The Landing Worker script is configured to bypass/forward requests starting with `/blog` using `return fetch(request)`.

2. **Astro Blog:**
   - Bind the **Cloudflare Pages** project (`sidelabs-blog`) to the custom domain `sidelabs.net` with the path prefix `/blog` in the Cloudflare Page's custom domains settings.

3. **Email Worker:**
   - Map route `sidelabs.net/api/contact` explicitly to the **Email Worker** in the custom routes configuration. Cloudflare prioritizes more specific route mappings (like `/api/contact`) over wildcard patterns (like `sidelabs.net/*`), routing traffic automatically to the correct worker.
