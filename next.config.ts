import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.18.8"],
  images: {
    // Serve images straight from R2 instead of through Vercel's image
    // optimizer. On Hobby the optimizer has a monthly transformation quota;
    // photo-heavy post pages blew past it and every next/image request started
    // returning 402 (OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED) → broken images.
    // The R2 media is already Cloudflare-served (free egress, CDN-cached) and
    // FB-export sized (~200 KB median), so skipping the optimizer costs little:
    // lazy-loading and layout stability are unaffected; the only tradeoff is no
    // per-device srcset/AVIF. If those are wanted back later, move optimization
    // to Cloudflare (image resizing) or pre-generate variants in the ETL — not
    // Vercel.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
