import type { ReactNode } from "react";
import ChatWorkspace from "@/components/admin/chat/ChatWorkspace";

// Chat lives here rather than under /admin/chat so an answer keeps generating
// while the user visits other admin pages.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <ChatWorkspace>{children}</ChatWorkspace>;
}
