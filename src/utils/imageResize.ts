// Builds a Cloudflare Image Resizing URL (`/cdn-cgi/image/...`) for a small
// preview of an R2-hosted image, instead of shipping the full-resolution
// original for a 56-160px thumbnail. R2 media is already served through
// Cloudflare on a custom domain, so this works without moving the images
// anywhere — see docs/COST_TRACKING.md for the R2 setup and the pricing
// this assumes (first 5,000 unique transforms/month free, then $0.50/1,000,
// no paid zone plan required).
//
// Requires Image Resizing/Transformations to be enabled for the asset
// domain's Cloudflare zone. Every caller MUST also set an `onError` handler
// falling back to the original `uri` — if the feature isn't enabled (or
// isn't enabled yet), Cloudflare returns an error response instead of the
// image, and without a fallback the thumbnail would just be broken.
export function getThumbnailUrl(uri: string, width: number, height: number): string {
  try {
    const url = new URL(uri);
    return `${url.origin}/cdn-cgi/image/width=${width},height=${height},fit=cover,quality=75,format=auto${url.pathname}`;
  } catch {
    return uri;
  }
}

// Same idea, for a large hero/cover image rather than a fixed-box thumbnail:
// width-only (no height/fit=cover), since the display box's aspect ratio
// varies with viewport size and CSS object-cover already handles the final
// crop — this just stops shipping the full-resolution original when the
// rendered width is a fraction of it. `fit=scale-down` never upscales a
// smaller original past its real size.
export function getResizedImageUrl(uri: string, width: number): string {
  try {
    const url = new URL(uri);
    return `${url.origin}/cdn-cgi/image/width=${width},fit=scale-down,quality=80,format=auto${url.pathname}`;
  } catch {
    return uri;
  }
}
