// Client-side mirror of MaraMap-Backend's generic-bot-pattern.ts +
// ai-crawler-patterns.ts, merged into one check since the frontend only
// needs a yes/no answer (the backend still separately identifies *which*
// bot, for crawler_visits/IndexNow logging).
//
// This is a noise-reduction layer only, not a security boundary: the
// backend already refuses to act on these requests either way (see
// stats.controller.ts's recordVisit and translations.service.ts's
// triggerContentTranslation) — this just stops a JS-executing crawler
// (e.g. Google's "GoogleOther") from sending the POST at all, so it never
// shows up as network noise / a crawler_visits row in the first place.
const BOT_PATTERN =
  /bot|spider|crawler|crawl|slurp|fetch|scan|check|monitor|scrape|archive|feed|reader|parser|headless|python|java|ruby|curl|wget|axios|libwww|go-http|http-client|okhttp|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegram|applebot|yandex|baidu|duckduck|semrush|ahrefs|mj12|dotbot|petalbot|oai-searchbot|meta-externalagent|perplexitybot|chatgpt-user|claude-user|claude-searchbot|anthropic-ai|perplexity-user|google-extended|googleother|amazonbot|duckassistbot|youbot|diffbot|cohere-ai|timpibot/i;

export function isBotUserAgent(userAgent: string | undefined | null): boolean {
  return !!userAgent && BOT_PATTERN.test(userAgent);
}
