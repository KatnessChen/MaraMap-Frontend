"use client";

import { Link } from "@/i18n/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { useTranslations } from "next-intl";

export default function ContactPage() {
  const t = useTranslations("Contact");

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-paper">
      <main className="max-w-xl mx-auto px-6 py-10 flex flex-col items-center text-center">
        <Link
          href="/"
          className="self-start inline-flex items-center gap-2 text-ink/60 hover:text-brand font-sans text-base font-black mb-10 transition-colors"
        >
          <ArrowLeft size={18} /> {t("backHome")}
        </Link>

        <h1 className="font-sans font-bold text-2xl md:text-3xl text-ink tracking-tight mb-8">
          {t("pageTitle")}
        </h1>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/contact-photo.jpg"
          alt={t("photoAlt")}
          className="w-full rounded-sm border border-line object-cover mb-8"
        />

        <p className="font-mono text-sm text-ink/60 uppercase tracking-widest mb-2">
          {t("country")}
        </p>
        <a
          href="mailto:iaak01@yahoo.com.tw"
          className="font-mono text-base text-ink hover:text-brand transition-colors inline-flex items-center gap-2"
        >
          <Mail size={16} className="shrink-0" />
          {t("emailLabel")}: iaak01@yahoo.com.tw
        </a>
      </main>
    </div>
  );
}
