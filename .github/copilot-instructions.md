# GitHub Copilot Instructions — MaraMap Frontend

## Project Overview

MaraMap-Frontend is a **Next.js** web application that serves as the public-facing interface for the MaraMap platform — a geospatial blog for marathon and travel logs.

It has two main surfaces:
1. **Public Site** — post feed, individual log pages, map view
2. **Admin Dashboard** — hidden at `/admin`, protected by a simple JWT login

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) with Turbopack |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Package Manager | **bun** (always use `bun`, never `npm` or `yarn`) |
| Map | React Leaflet + react-leaflet-cluster |
| Icons | lucide-react |

```bash
bun add <package>         # add dependency
bun add -D <package>      # add dev dependency
bun install               # install all dependencies
bun run dev               # start dev server (port 3000)
bun run build             # production build
bun run lint              # lint
```

---

## Route Structure

| Route | Type | Description |
|-------|------|-------------|
| `/` | Server Component | Home page — post feed + stats blocks |
| `/log/[id]` | Server Component | Single post detail page |
| `/map` | Client Component | Interactive map with markers |
| `/admin` | Client Component | Admin post management dashboard |
| `/admin/login` | Client Component | Admin login page |
| `/admin/edit/[id]` | Client Component | Edit a single post |

---

## Backend API

All API calls point to `process.env.NEXT_PUBLIC_API_URL` (default: `http://127.0.0.1:3001`).

### Key Endpoints

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/v1/posts` | GET | List posts — supports `page`, `limit`, `category`, `status`, `order`, `tag`, `startDate`, `endDate`, `showHidden` |
| `/api/v1/posts/search` | GET | Fuzzy search — `q`, `limit`, `offset`, `category` |
| `/api/v1/posts/:id` | GET | Single post |
| `/api/v1/posts/:id` | PATCH | Update post (requires `Authorization: Bearer <token>`) |
| `/api/v1/locations` | GET | Map markers |
| `/api/v1/categories` | GET | Category list with counts |
| `/api/v1/stats` | GET | Aggregate statistics |
| `/api/v1/auth/login` | POST | Returns `{ token }` — no auth required |

### Auth Conventions

- Token stored in `localStorage` as `maramap_admin_token`
- Login timestamp stored as `maramap_admin_login_time` (used to enforce 1-hour expiry client-side)
- On 401: clear both keys and redirect to `/admin/login`
- `PATCH /api/v1/posts/:id` requires `Authorization: Bearer <token>` header

---

## Component Conventions

- Server Components fetch data directly and pass as props to Client Components
- Client Components handle interactivity, infinite scroll, and state
- Use `"use client"` only when necessary
- Avoid hardcoding `http://127.0.0.1:3000` — always use `process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'`

---

## Key Components

| Component | Description |
|-----------|-------------|
| `PostFeed` | Client Component — infinite scroll feed with search and category filter |
| `MapView` | Client Component — Leaflet map with marker clustering and geographic filtering |
| `AggregateStatsSection` | Stats summary section |
| `StatisticsBlock` | Per-participant stats (Davis / Rose) |

---

## Important Rules

- Never hardcode the API base URL — always use `NEXT_PUBLIC_API_URL`
- Never store sensitive data beyond the auth token in `localStorage`
- Admin routes must check auth on mount and redirect if token is missing or expired
- `cover_image` must always be included in `Post` interfaces and rendered when present
- Use `bun`, never `npm` or `yarn`
