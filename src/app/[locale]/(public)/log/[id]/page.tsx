import type { Metadata } from "next";
import { getApiBase } from "@/utils/apiBase";
import { SITE_URL } from "@/utils/siteUrl";
import LogDetailClient, { type Post } from "./LogDetailClient";

// Shared by generateMetadata and the page component below — Next.js
// memoizes identical fetch() calls (same URL + options) within one request,
// so fetching the full post twice costs one network round trip, not two.
async function fetchPost(id: string): Promise<Post | null> {
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
  const post = await fetchPost(id);
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

// JSON-LD for the article — lets a crawler read the race's actual facts
// (name, date, location, finish time) as structured data instead of having
// to parse them back out of the prose. Same zh-default/en-if-translated
// selection generateMetadata already uses above, so the structured data
// never disagrees with what's visibly on the page.
function buildJsonLd(post: Post, locale: string, id: string) {
  const isEn = locale === "en";
  const path = isEn ? `/en/log/${id}` : `/log/${id}`;
  const url = `${SITE_URL}${path}`;
  const title = isEn && post.title_en ? post.title_en : post.title;
  const articleBody = isEn && post.content_en ? post.content_en : post.content;

  const raceName =
    (isEn && post.metadata?.race_name_en) || post.metadata?.race_name;
  const country =
    (isEn && post.metadata?.country_en) || post.metadata?.country;
  const city = (isEn && post.metadata?.city_en) || post.metadata?.city;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: post.event_date,
    inLanguage: isEn ? "en" : "zh-TW",
    image: post.cover_image ? [post.cover_image] : undefined,
    articleBody,
    author: { "@type": "Person", name: "Davis & Rose" },
    publisher: { "@type": "Organization", name: "MaraMap", url: SITE_URL },
  };

  // Only marathon posts with an actual race name get the SportsEvent facet —
  // a travel/hiking post's metadata shares the same shape but isn't a race.
  if (post.category === "馬拉松" && raceName) {
    jsonLd.about = {
      "@type": "SportsEvent",
      name: raceName,
      startDate: post.event_date,
      location:
        country || city
          ? {
              "@type": "Place",
              address: {
                "@type": "PostalAddress",
                addressLocality: city || undefined,
                addressCountry: country || undefined,
              },
            }
          : undefined,
    };
  }

  return jsonLd;
}

export default async function LogDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  // Only the public (non-preview) version is fetched here — preview mode is
  // an admin-only draft view driven by a client-side query param, so it
  // keeps going through LogDetailClient's own fetch-on-mount, same as
  // before. A post that isn't public yet (or doesn't exist) resolves to
  // null here, and LogDetailClient falls back to its pre-existing loading
  // state while its own effect fetches (or 404s).
  const initialPost = await fetchPost(id);

  return (
    <>
      {initialPost && (
        <script
          type="application/ld+json"
          // JSON.stringify doesn't escape "<", so a stray "</script>" inside
          // post content could otherwise break out of this tag.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildJsonLd(initialPost, locale, id)).replace(
              /</g,
              "\\u003c",
            ),
          }}
        />
      )}
      <LogDetailClient params={params} initialPost={initialPost} />
    </>
  );
}
