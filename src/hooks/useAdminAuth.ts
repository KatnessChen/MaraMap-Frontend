"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TOKEN_KEY = "maramap_admin_token";

// The JWT's own `exp` claim is the backend's actual source of truth for
// validity — decode it directly rather than tracking a separate client-side
// login timestamp, which can silently drift out of sync with whatever TTL
// the backend issues. The backend also doesn't 401 an expired token on every
// endpoint (findOne quietly falls back to public/unauthenticated behavior),
// so this check has to happen client-side to catch it.
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// Synchronous read for call sites that need a token right before a fetch
// (form submits, uploads) rather than waiting on the mount-time check below.
export function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || isTokenExpired(token)) {
    if (token) localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// The one auth guard every /admin page runs on mount: read the token, check
// it against its own expiry, and redirect to /admin/login (preserving the
// current path) if it's missing or expired. `token` stays null until the
// check resolves, so a page can hold off fetching/rendering until then.
export function useAdminAuth(): { token: string | null; isChecking: boolean } {
  const router = useRouter();
  const [state, setState] = useState<{ token: string | null; isChecking: boolean }>({
    token: null,
    isChecking: true,
  });

  useEffect(() => {
    const checkAuth = () => {
      const stored = getStoredToken();
      if (!stored) {
        router.push(`/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      setState({ token: stored, isChecking: false });
    };
    checkAuth();
  }, [router]);

  return state;
}
