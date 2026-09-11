import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "MaraMap // 運動地理日誌",
  description: "以配速書寫地理，用腳步丈量歲月。",
  verification: {
    google: "fi0ZCHgkTh8iwm-ZLqFgH6UJ9653pIIzcztsYf_btyY",
  },
};

// This one request is ~695KB (Traditional Chinese needs many unicode-range
// @font-face blocks per weight) — the single biggest byte-weight item on the
// page (Lighthouse, 2026-09-10), and as a blocking <link rel="stylesheet">
// it held up first paint on every page. Extracted to a constant since it's
// now referenced from three places below.
const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&family=Noto+Sans+TC:wght@300;400;500;700;900&family=JetBrains+Mono:wght@400;700;800&family=Space+Grotesk:wght@400;500;700&display=swap";

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
            heading depends on. Space Grotesk backs `--font-mono` on the /en
            locale only (see globals.css `[data-locale="en"]`) — JetBrains
            Mono reads as source code for English UI prose, whereas on zh
            pages font-mono only ever touched digits/short Latin tags. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Loaded non-render-blocking (the "print" media swap trick, see
            https://web.dev/articles/defer-non-critical-css): `media="print"`
            tells the browser this stylesheet doesn't apply to the current
            render, so it fetches it without holding up first paint; the
            inline script then flips it to "all" the instant the <link>
            element exists in the DOM (not after `load` — the browser already
            decided not to block on this resource the moment it saw
            media="print", so flipping the attribute later doesn't change
            that). `display=swap` in the URL still governs the swap-in of
            each individual @font-face once the CSS does apply. <noscript>
            covers the (here, negligible) case of JS disabled. */}
        <link rel="preload" as="style" href={GOOGLE_FONTS_HREF} />
        <link
          rel="stylesheet"
          href={GOOGLE_FONTS_HREF}
          media="print"
          id="google-fonts-css"
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.getElementById('google-fonts-css').media='all';",
          }}
        />
        <noscript>
          <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />
        </noscript>
      </head>
      <body className="bg-paper text-ink font-sans antialiased selection:bg-brand selection:text-white">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
      {/* VERCEL_ENV (unset locally, "preview" on PR deploys, "production" only
          on the real domain) keeps local dev and every PR's preview URL from
          reporting into the same GA4 property as real visitors. */}
      {process.env.VERCEL_ENV === "production" && (
        <GoogleAnalytics gaId="G-LXMZMKP14V" />
      )}
    </html>
  );
}
