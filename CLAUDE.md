# CLAUDE.md

Guidance for Claude Code (and other AI coding agents) working in this repo.

## Read `docs/` before non-trivial work

`docs/` holds this project's working context — specs, decisions still in
flight, the backlog, known issues. It's intentionally gitignored (internal
planning notes, not shipped app content), so it only exists in this local
checkout and won't show up in a fresh clone or in the public README — this
file is the only pointer to it. If the folder is missing, it just hasn't
been recreated locally yet; proceed without it rather than treating that as
an error.

Read the relevant doc(s) before starting work in that area, not the whole
folder every time:

| Doc | What | Read before touching... |
|---|---|---|
| [`docs/TODO.md`](./docs/TODO.md) | Live TODO / backlog / completed log by meeting date | Anything — check current priorities and what's already decided |
| [`docs/DESIGN_GUIDELINES.md`](./docs/DESIGN_GUIDELINES.md) | Mobile-first, RWD and accessibility principles | Layout, styling, responsive behavior |
| [`docs/data-pipeline.md`](./docs/data-pipeline.md) | How posts get from Facebook to the site (client + developer versions) | The import/ingestion flow, post data shape |
| [`docs/VIDEO_PLAN.md`](./docs/VIDEO_PLAN.md) | Video compression research and the unresolved `.mov` playback issue | Video upload, playback, or the media pipeline |
| [`docs/COST_TRACKING.md`](./docs/COST_TRACKING.md) | Monthly infra cost snapshot workflow | Infra/cost-sensitive changes (R2, Vercel, Supabase usage) |
| [`docs/CHATBOT_PLAN.md`](./docs/CHATBOT_PLAN.md) | AI chatbot plan | The (not-yet-built) chatbot feature |
| [`docs/I18N_PLAN.md`](./docs/I18N_PLAN.md) | English localisation plan | i18n/localization work |
| [`docs/SPEC.md`](./docs/SPEC.md) | Chrome extension spec (separate ingestion front-end) | The browser-extension ingestion tool |

Also read [`README.md`](./README.md)'s "Decisions worth knowing before you
change things" section — those are hard-won constraints (image optimizer,
font loading, video `preload`, lockfiles) that aren't in `docs/`.

## E2E tests must never depend on a real backend

`.github/workflows/ci.yml` runs `bun run test:e2e` without ever starting the
NestJS backend — CI only has the frontend's own `next dev` (via Playwright's
`webServer`). A Playwright test that expects real data from `getApiBase()`'s
target will pass locally (backend happens to be running on your machine) and
then fail or silently assert nothing in CI.

Mock every backend call the page under test makes with `page.route()`,
keyed on the actual resolved origin (`**://*:3001/api/v1/...`, since
`src/utils/apiBase.ts` derives the port at runtime rather than reading an
env var in dev). See `tests/e2e/fixtures/` for the established pattern —
one fixture file per page/flow, exporting both the mock data and a
`mock*Api(page)` helper that registers the routes.

`/countries.geojson` is the one exception: it's a real static file the
Next.js dev server serves itself, not a backend call, so it's left unmocked.
