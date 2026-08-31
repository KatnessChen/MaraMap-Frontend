"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function QRCodePage() {
  // Read from window rather than hardcode a domain — the production URL
  // isn't finalized yet (see docs/TODO.md item 8), and this way the page
  // is correct on localhost, on a phone on the LAN, and in production
  // without ever needing an update. Same reasoning as src/utils/apiBase.ts.
  const [siteUrl, setSiteUrl] = useState("");
  useEffect(() => {
    const readOrigin = () => setSiteUrl(window.location.origin);
    readOrigin();
  }, []);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-paper">
      <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col items-center text-center">
        <Link
          href="/"
          className="self-start inline-flex items-center gap-2 text-ink/60 hover:text-brand font-sans text-base font-black mb-10 transition-colors"
        >
          <ArrowLeft size={18} /> 回到首頁
        </Link>

        <div className="bg-white border border-line p-8 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/qrcode.gif"
            alt="MaraMap 網站 QR Code"
            width={256}
            height={256}
            className="w-64 h-64"
          />
        </div>

        {siteUrl && (
          <p className="mt-8 font-mono text-lg text-ink/70 break-all">{siteUrl}</p>
        )}
      </main>
    </div>
  );
}
