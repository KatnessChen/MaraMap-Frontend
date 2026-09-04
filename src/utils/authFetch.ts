// Thin wrapper around fetch() that adds the admin Bearer header, so call
// sites stop hand-assembling `{ headers: { Authorization: `Bearer ${token}` } }`.
// Token stays an explicit param (rather than reading getStoredToken() here)
// since every call site already holds the token for its own 401 handling.
export function authFetch(
  input: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: authHeaders(token, init.headers as Record<string, string> | undefined),
  });
}

// For call sites that build their own RequestInit and pass it to something
// other than fetch() directly (e.g. a local SSE/streaming helper).
export function authHeaders(
  token: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return { ...extra, Authorization: `Bearer ${token}` };
}
