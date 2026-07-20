// Single source of truth for the backend API base URL.
//
// - Production / explicit override: whatever NEXT_PUBLIC_API_URL is set to
//   (e.g. the Cloud Run URL in .env.production).
// - Local dev (NEXT_PUBLIC_API_URL left empty): derive the base from the
//   page's own hostname so the app works from BOTH the laptop (localhost) and
//   a phone on the same LAN (the machine's LAN IP) — and keeps working when
//   that IP changes, with no hardcoded address to update.
//
// The SSR fallback (127.0.0.1) only matters on the dev machine itself, where
// the Next server and the backend share a host.
const DEV_BACKEND_PORT = "3001";

export function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_BACKEND_PORT}`;
  }
  return `http://127.0.0.1:${DEV_BACKEND_PORT}`;
}
