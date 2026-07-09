import SiteHeader from "@/components/SiteHeader";
import PageViewTracker from "@/components/PageViewTracker";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ height: '100dvh' }}>
      <SiteHeader />
      <PageViewTracker />
      {children}
    </div>
  );
}
