import type { ReactNode } from "react";

/**
 * The content width and heading shared by admin pages. `actions` stay on screen
 * below the fixed menu while the page scrolls.
 */
export default function AdminPage({
  title,
  accent,
  description,
  actions,
  children,
}: {
  title: string;
  accent: string;
  description: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[calc(100dvh-var(--admin-menu-height,0px))] bg-paper text-ink p-4 sm:p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 border-b-2 border-ink pb-6">
          <h1 className="font-serif font-black text-3xl sm:text-4xl text-ink tracking-tight mb-2">
            {title}
            <span className="text-brand">{accent}</span>
          </h1>
          <p className="font-sans text-sm text-ink/60">{description}</p>
        </header>
        {actions && (
          <div className="sticky top-[var(--admin-menu-height,0px)] z-40 flex flex-wrap items-center justify-end gap-3 mb-8 py-2 bg-paper/95 backdrop-blur">
            {actions}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
