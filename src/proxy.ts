import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Runs on every public route; explicitly skips /admin and /chat (single-language,
  // client-only tools — see docs/I18N_PLAN.md), /api, Next internals, and
  // any request for a file with an extension (static assets).
  matcher: ["/((?!api|_next|_vercel|admin|chat|.*\\..*).*)"],
};
