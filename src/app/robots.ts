import type { MetadataRoute } from "next";
import { SITE_URL } from "@/utils/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Admin is internal-only (single operator, not localized — see
        // docs/I18N_PLAN.md) and the QR-code page is a physical-poster
        // scan target, not content anyone should land on via search.
        // /chat stays crawlable on purpose: a crawler has to read its noindex
        // tag to keep the URL out of results.
        disallow: ["/admin", "/qrcode", "/en/qrcode"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
