import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MaraMap // 運動地理日誌",
  description: "以配速書寫地理，用腳步丈量歲月。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        {/* Fonts are linked at runtime rather than pulled in via
            `next/font/google`. next/font downloads the woff2 files during the
            build, and when the Vercel builder could not reach fonts.gstatic.com
            the whole build failed hard (27 × "Can't resolve
            @vercel/turbopack-next/internal/font/google/font") with no fallback.
            A plain stylesheet link keeps the build fully offline.
            Weights must stay in sync with the `font-*` utilities in use —
            serif 900 in particular, which every `font-serif font-black`
            heading depends on. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&family=Noto+Sans+TC:wght@300;400;500;700;900&family=JetBrains+Mono:wght@400;700;800&display=swap"
        />
      </head>
      <body className="bg-paper text-ink font-sans antialiased selection:bg-brand selection:text-white">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
