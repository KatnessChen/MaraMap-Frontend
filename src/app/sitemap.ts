import type { MetadataRoute } from "next";
import { getApiBase } from "@/utils/apiBase";
import { SITE_URL } from "@/utils/siteUrl";

interface PostListItem {
  id: string;
  event_date: string;
}

async function fetchAllVisiblePosts(): Promise<PostListItem[]> {
  try {
    // 634 posts today, comfortably under one page — revisit with real
    // pagination if the corpus grows large enough for this to matter.
    const res = await fetch(`${getApiBase()}/api/v1/posts?status=visible&limit=5000`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const body: { data: PostListItem[] } = await res.json();
    return body.data || [];
  } catch {
    return [];
  }
}

async function fetchContentStatusMap(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${getApiBase()}/api/v1/translations/content-status`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

// zh URLs are always included — they're the original content and were
// already indexed before this pipeline existed. An /en/log/[id] URL is only
// listed once its content_status is 'done': before that it's either absent
// or serving the Chinese-fallback placeholder, and advertising it to Google
// would just get a thin/mismatched-language page indexed. See
// docs/I18N_PLAN.md's "SEO 與 URL" section.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, statusMap] = await Promise.all([
    fetchAllVisiblePosts(),
    fetchContentStatusMap(),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { "zh-TW": SITE_URL, en: `${SITE_URL}/en` } },
    },
    {
      url: `${SITE_URL}/personal-best`,
      changeFrequency: "monthly",
      priority: 0.5,
      alternates: {
        languages: {
          "zh-TW": `${SITE_URL}/personal-best`,
          en: `${SITE_URL}/en/personal-best`,
        },
      },
    },
  ];

  const postEntries: MetadataRoute.Sitemap = posts.flatMap((post) => {
    const zhUrl = `${SITE_URL}/log/${post.id}`;
    const enUrl = `${SITE_URL}/en/log/${post.id}`;
    const lastModified = post.event_date ? new Date(post.event_date) : undefined;
    const translated = statusMap[post.id] === "done";

    const zhEntry: MetadataRoute.Sitemap[number] = {
      url: zhUrl,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.6,
      alternates: translated ? { languages: { "zh-TW": zhUrl, en: enUrl } } : undefined,
    };
    if (!translated) return [zhEntry];

    const enEntry: MetadataRoute.Sitemap[number] = {
      url: enUrl,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.6,
      alternates: { languages: { "zh-TW": zhUrl, en: enUrl } },
    };
    return [zhEntry, enEntry];
  });

  return [...staticEntries, ...postEntries];
}
