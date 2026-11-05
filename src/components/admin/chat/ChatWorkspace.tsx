"use client";

import { ReactNode, useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { clearStoredToken, useAdminAuth } from "@/hooks/useAdminAuth";
import AdminMenu from "@/components/admin/AdminMenu";
import ChatShell from "./ChatShell";

function isChatPath(pathname: string): boolean {
  return pathname === "/admin/chat" || pathname.startsWith("/admin/chat/");
}

/**
 * Mounted from the admin layout. Nothing loads until chat is first opened, and
 * signing out tears it down. Other admin pages render as usual beside it.
 */
export default function ChatWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isChatRoute = isChatPath(pathname);
  const isLoginRoute = pathname.startsWith("/admin/login");
  const [hasOpenedChat, setHasOpenedChat] = useState(isChatRoute);

  if (isChatRoute && !hasOpenedChat) setHasOpenedChat(true);
  if (isLoginRoute && hasOpenedChat) setHasOpenedChat(false);

  return (
    <div data-admin className={isChatRoute ? "h-dvh flex flex-col bg-paper" : undefined}>
      {!isLoginRoute && <AdminMenu />}
      {children}
      {hasOpenedChat && <ChatGate isChatRoute={isChatRoute} routePathname={pathname} />}
    </div>
  );
}

function ChatGate({ isChatRoute, routePathname }: { isChatRoute: boolean; routePathname: string }) {
  const router = useRouter();
  const { token, isChecking } = useAdminAuth();
  const handleUnauthorized = useCallback(() => {
    clearStoredToken();
    router.push(`/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`);
  }, [router]);
  if (isChecking || !token) {
    return isChatRoute ? (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-paper">
        <Loader2 className="animate-spin text-ink/40" aria-label="載入中" />
      </div>
    ) : null;
  }
  return (
    <ChatShell
      token={token}
      isChatRoute={isChatRoute}
      pathname={routePathname}
      routeBase="/admin/chat"
      apiPath="/api/v1/admin/chat"
      showGuestChats
      onUnauthorized={handleUnauthorized}
    />
  );
}
