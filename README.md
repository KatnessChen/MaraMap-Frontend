# 🗺️ MaraMap Frontend

The Next.js web app for MaraMap — a running and travel log that turns years of
Facebook posts into an interactive map, timeline and list.

Pairs with [MaraMap-Backend](https://github.com/KatnessChen/MaraMap-Backend)
(NestJS Content API + Supabase + Cloudflare R2).

## Tech stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + React 19 |
| Styling | Tailwind CSS v4 |
| Map | Leaflet + react-leaflet + marker clustering |
| Motion / icons | framer-motion, lucide-react |
| Tests | Jest + Testing Library (unit), Playwright (E2E) |
| Package manager | **Bun** (what CI uses) |
| Hosting | Vercel |

## Getting Started

```bash
bun install        # also installs the pre-push git hook (see Testing)
bun run dev        # http://localhost:3000
```

The app needs the backend running on **port 3001** for anything data-driven.

### Environment variables

Only one variable matters: `NEXT_PUBLIC_API_URL`.

| File | Value | When |
|---|---|---|
| `.env.local` | *(empty)* | Local dev — see below |
| `.env.development` | explicit URL | Pointing dev at a remote backend |
| `.env.production` | Cloud Run URL | Production build |

**Leave it empty for local dev.** `src/utils/apiBase.ts` then derives the backend
URL from the page's own hostname, so the app works from both the laptop
(`localhost:3001`) *and* a phone on the same LAN (`<machine-LAN-IP>:3001`) with
no hardcoded address to update when the IP changes.

## Project structure

```
src/
  app/
    (public)/          # Public site — home, /log/[id], /personal-best
    admin/             # Admin area — login, new, edit/[id], import, personal-best
    map/               # Full-screen map view
  components/          # MapView, ListView, TimelineView, CountryModal, SiteHeader…
    admin/             # MediaManager, Combobox
  utils/               # apiBase, formatLocation, locationData, postHelpers
```

### Routes

| Route | Purpose |
|---|---|
| `/` | Home — map / list / timeline of all posts |
| `/log/[id]` | Single post with photo and video carousels + lightbox |
| `/personal-best` | Personal-best records |
| `/map` | Full-screen map |
| `/admin` | Post management (JWT auth against the backend) |
| `/admin/new`, `/admin/edit/[id]` | Create / edit a post, with direct-to-R2 media upload |
| `/admin/import` | Facebook export import review flow |

## Testing

```bash
bun run test          # Jest unit tests with coverage
bun run test:watch
bun run test:e2e      # Playwright (starts its own dev server on :3000)
bun run test:e2e:ui   # Playwright UI mode
bun run lint
```

A **pre-push hook** (`.githooks/pre-push`, installed automatically by the
`prepare` script) runs `eslint --fix`, amends any auto-fixes into the last
commit, then runs the unit tests and aborts the push if they fail.

## CI

`.github/workflows/ci.yml` runs on push and PR to `develop` / `main`:
lint → unit tests → Playwright E2E → `bun run build`. Test results are published
as PR checks via `dorny/test-reporter`.

## Decisions worth knowing before you change things

These are non-obvious and each one was learned the hard way.

**Images bypass the Vercel image optimizer** (`next.config.ts`,
`images.unoptimized: true`). On the Hobby plan the optimizer has a monthly
transformation quota; photo-heavy post pages blew past it and every
`next/image` request started returning `402`, breaking every image. R2 media is
already Cloudflare-served (free egress, CDN-cached) and FB-export sized
(~200 KB median). If per-device `srcset`/AVIF is wanted back, do it in
Cloudflare or pre-generate variants in the ETL — **not** Vercel.

**Fonts are loaded with a plain `<link>`, not `next/font/google`**
(`src/app/layout.tsx`). `next/font` downloads woff2 files at build time, and
when the Vercel builder could not reach `fonts.gstatic.com` the build hard-failed
with no fallback. Weights must stay in sync with the `font-*` utilities in use —
serif 900 in particular, which every `font-serif font-black` heading depends on.

**Video `preload` is deliberate, not accidental** (`src/app/(public)/log/[id]/page.tsx`).
The main carousel keeps `preload="metadata"` because the first frame *is* the
visual there. The thumbnail rail renders an icon tile instead of a `<video>`
(at 56 px the frame is unreadable, and each one costs a metadata fetch), and the
lightbox uses `preload="none"` because every slide in the strip is rendered at
once. See [`docs/VIDEO_PLAN.md`](./docs/VIDEO_PLAN.md).

**Three lockfiles are present** (`bun.lock`, `pnpm-lock.yaml`,
`package-lock.json`). CI and the git hooks use **Bun** — that is the source of
truth. A past package-manager switch dropped the Vercel build cache and
contributed to a build failure, so be deliberate about which one you touch.

## Docs

| Doc | What |
|---|---|
| [`DESIGN_GUIDELINES.md`](./docs/DESIGN_GUIDELINES.md) | Mobile-first, RWD and accessibility principles |
| [`TODO.md`](./docs/TODO.md) | Live TODO / backlog / completed log by meeting date |
| [`data-pipeline.md`](./docs/data-pipeline.md) | How posts get from Facebook to the site (client + developer versions) |
| [`VIDEO_PLAN.md`](./docs/VIDEO_PLAN.md) | Video compression research and the unresolved `.mov` playback issue |
| [`COST_TRACKING.md`](./docs/COST_TRACKING.md) | Monthly infra cost snapshot workflow |
| [`CHATBOT_PLAN.md`](./docs/CHATBOT_PLAN.md) | AI chatbot plan |
| [`I18N_PLAN.md`](./docs/I18N_PLAN.md) | English localisation plan |
| [`SPEC.md`](./docs/SPEC.md) | Chrome extension spec (separate ingestion front-end) |
