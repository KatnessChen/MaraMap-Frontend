import SiteHeader from "@/components/SiteHeader";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ height: '100dvh' }}>
      <SiteHeader />
      {children}
    </div>
  );
}
