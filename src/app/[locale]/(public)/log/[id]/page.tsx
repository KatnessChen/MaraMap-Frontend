import type { Metadata } from "next";
import { getApiBase } from "@/utils/apiBase";
import LogDetailClient from "./LogDetailClient";

interface MetaPost {
  title: string;
  title_en?: string | null;
  content: string;
  content_en?: string | null;
  content_status?: "pending" | "done" | "failed" | null;
  cover_image?: string;
}

async function fetchPostForMetadata(id: string): Promise<MetaPost | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/v1/posts/${id}`, {
      // Metadata shouldn't itself trigger the lazy translation side-effect —
      // that's LogDetailClient's job via its dedicated /translate call. This
      // is a plain read.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Per-article <title>/description, hreflang and robots — separated from the
// interactive body (LogDetailClient, "use client") because generateMetadata
// only runs in a server component. Content translation stays lazy (see
// TranslationsService on the backend): the English URL is only advertised as
// an indexable alternate, and only left indexable itself, once
// content_status is actually 'done' — otherwise a crawler's first visit
// would index a Chinese-text page sitting at an English URL. See
// docs/I18N_PLAN.md's "SEO 與 URL" section for the fuller rationale.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const post = await fetchPostForMetadata(id);
  if (!post) return {};

  const isEn = locale === "en";
  // Titles are translated eagerly for every post (see
  // TranslationsService.translateMissingTitles), independent of content —
  // so the <title> tag should use title_en whenever it exists, not wait on
  // content_status. Content stays lazy, so the description falls back to
  // the zh text the same way the article body does when untranslated.
  const translated = post.content_status === "done";
  const title = isEn && post.title_en ? post.title_en : post.title;
  const rawContent = isEn && post.content_en ? post.content_en : post.content;
  const description = rawContent?.slice(0, 140).replace(/\s+/g, " ").trim();

  const zhPath = `/log/${id}`;
  const enPath = `/en/log/${id}`;

  return {
    title,
    description,
    alternates: {
      canonical: isEn ? enPath : zhPath,
      // Only advertise the English URL as an alternate once it actually has
      // translated content — an hreflang pointing at a noindex placeholder
      // is a Search Console warning waiting to happen, and there's no
      // benefit to advertising a page that isn't ready.
      languages: translated ? { "zh-TW": zhPath, en: enPath } : { "zh-TW": zhPath },
    },
    openGraph: {
      title,
      description,
      images: post.cover_image ? [post.cover_image] : undefined,
      url: isEn ? enPath : zhPath,
    },
    // Only the English side ever needs noindex: the zh URL is the original,
    // always-indexable content regardless of translation state.
    robots: isEn && !translated ? { index: false, follow: true } : undefined,
  };
}

export default function LogDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  return <LogDetailClient params={params} />;
}
