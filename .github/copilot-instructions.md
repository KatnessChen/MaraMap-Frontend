# GitHub Copilot Instructions — MaraMap Chrome Extension

## API Specification

The MaraMap Backend OpenAPI spec is available at the local path:

```
/Users/kc/Develop/06_MaraMap/MaraMap-Backend/docs/openapi.json
```

When generating HTTP requests or working on anything that calls the backend, always read this file first to ensure the request shape, headers, and response handling match the defined spec.

To regenerate the spec after backend API changes:

```bash
cd /Users/kc/Develop/06_MaraMap/MaraMap-Backend
pnpm gen:spec
```

### Key Notes

- All endpoints are prefixed with `/api/v1/` except `GET /health-check`.
- Obtain a token via `POST /api/v1/auth/login` — no `Authorization` header required for this endpoint.
- All other authenticated endpoints require `Authorization: Bearer <token>` (Supabase JWT).
- Token validity is **90 days**. On `401`, clear `chrome.storage.local` and redirect to the login page. No refresh token flow.
- The ingestion endpoint `POST /api/v1/ingest` returns **202 Accepted** — do not wait for processing to complete.
- Duplicate posts (same `source_id`) return **409 Conflict** and should be silently skipped.
