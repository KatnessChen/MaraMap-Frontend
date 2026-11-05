import type { Metadata } from "next";
import GuestChat from "@/components/chat/GuestChat";

export const metadata: Metadata = {
  title: "足跡問答 | MaraMap",
  robots: { index: false, follow: false },
};

// Lives in the layout, like admin chat, so moving between conversations doesn't
// cut off an answer.
export default function ChatLayout() {
  return <GuestChat />;
}
