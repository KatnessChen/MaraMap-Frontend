import { renderHook, waitFor } from "@testing-library/react";
import { isTokenExpired, getStoredToken, clearStoredToken, useAdminAuth } from "./useAdminAuth";

const TOKEN_KEY = "maramap_admin_token";

const pushMock = jest.fn();
// A real next/navigation router keeps a stable object reference across
// renders — the effect below depends on `router`, so a mock that returns a
// fresh object every call would re-fire the effect every render and loop.
const routerMock = { push: pushMock };
jest.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

function makeToken(expiresInSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: "1", exp: Math.floor(Date.now() / 1000) + expiresInSeconds }));
  return `${header}.${payload}.fakesig`;
}

beforeEach(() => {
  localStorage.clear();
  pushMock.mockClear();
  window.history.pushState({}, "", "/admin");
});

describe("isTokenExpired", () => {
  it("returns false for a token whose exp is in the future", () => {
    expect(isTokenExpired(makeToken(3600))).toBe(false);
  });

  it("returns true for a token whose exp is in the past", () => {
    expect(isTokenExpired(makeToken(-3600))).toBe(true);
  });

  it("returns true for a malformed token", () => {
    expect(isTokenExpired("not-a-jwt")).toBe(true);
  });
});

describe("getStoredToken", () => {
  it("returns null when nothing is stored", () => {
    expect(getStoredToken()).toBeNull();
  });

  it("returns the token when it is valid", () => {
    const token = makeToken(3600);
    localStorage.setItem(TOKEN_KEY, token);
    expect(getStoredToken()).toBe(token);
  });

  it("returns null and clears storage when the stored token is expired", () => {
    localStorage.setItem(TOKEN_KEY, makeToken(-3600));
    expect(getStoredToken()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe("clearStoredToken", () => {
  it("removes the token from storage", () => {
    localStorage.setItem(TOKEN_KEY, makeToken(3600));
    clearStoredToken();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe("useAdminAuth", () => {
  it("redirects to /admin/login with the current path when no token is stored", async () => {
    window.history.pushState({}, "", "/admin/edit/123");

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/login?redirect=%2Fadmin%2Fedit%2F123"));
    expect(result.current.isChecking).toBe(true);
    expect(result.current.token).toBeNull();
  });

  it("redirects when the stored token is expired", async () => {
    localStorage.setItem(TOKEN_KEY, makeToken(-3600));

    renderHook(() => useAdminAuth());

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/login?redirect=%2Fadmin"));
  });

  it("returns the token and stops checking when it is valid, without redirecting", async () => {
    const token = makeToken(3600);
    localStorage.setItem(TOKEN_KEY, token);

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.token).toBe(token);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
