// Fixture for the admin dashboard e2e suite. The header doesn't depend on the
// posts, so an empty list is enough.
import type { Page } from "@playwright/test";

export { seedAdminToken } from "./adminEditPost";

export async function mockAdminDashboardApi(page: Page): Promise<void> {
  await page.route("**://*:3016/api/v1/**", (route) =>
    route.fulfill({ json: { data: [], meta: { total: 0, limit: 20, page: 1, last_page: 1 } } }),
  );
}
