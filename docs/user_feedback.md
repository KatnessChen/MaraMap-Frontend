---
name: MaraMap — Rogers UX/Product Feedback
description: Power-user feedback on MaraMap from a marathon runner perspective — data model gaps, UX priorities, and what's missing from TODO
type: feedback
---

Reviewed on 2026-04-01 by invoking the /marathon-expert skill (Rogers persona — 200+ marathons, 15+ countries).

## Overall rating: 🟡 Partially right — some pivots needed

The race detail page and editorial aesthetic are genuinely strong. The product is structurally inside-out: currently a blog with a map, but it should be a map with a blog.

---

## Critical issues

**1. Map must be the homepage (TODO #5)**
- The map with GeoJSON country coloring is the emotional payoff and the product identity.
- A blog feed as homepage buries the hero moment.
- **Why:** Runners with races across 15+ countries have a map that tells their story — that's what makes them share it.
- **How to apply:** Ship TODO #5 before anything else.

**2. Country popup is missing (TODO #9)**
- Clicking a visited country does nothing. The GeoJSON coloring is decoration without interaction.
- A runner clicking Japan wants to see each city + race name + finish time.
- **How to apply:** This is the primary map interaction — not a nice-to-have.

**3. Finishing time invisible in post feed**
- `PostFeed` shows category/date/title/excerpt but no finish time.
- A marathon log without time is a sports article without the score.
- **How to apply:** `participants[].time` is already in the data model. Surface it on feed cards.

**4. No PB (personal best) flag**
- The single most important missing data attribute.
- A PB race should look visually different from a comfortable training run.
- **How to apply:** Add `is_pb: boolean` to the participant entry in the data model; display as a badge on cards.

**5. Single-select category filter conflicts with multi-category data model (TODO #6 + #10)**
- A race that is both 海外 and 超馬 disappears when filtering by one of its categories.
- **How to apply:** Multi-select is required before sub-categories make sense.

**6. Country statistics are faked**
- `AggregateStatsSection` has a hardcoded fallback of `15` and a `Math.max(uniqueLocations.size, 15)` hack.
- The count should use the `visitedCountries` Set already computed in `MapView`.

---

## TODO prioritization (from a runner's perspective)

**Ship first:**
1. #5 Map as homepage
2. #9 Country popup (primary map interaction)
3. #8 Country statistics (use real data, not hardcoded fallback)
4. #10 + #6 Multi-select categories

**Ship next:**
5. #3 Travel group mechanism (strong narrative differentiator)
6. #4 Admin sub-category management (unblocks #3)

**Can wait:**
7. #7 Map scroll restoration (PostFeed already handles this via sessionStorage)
8. #1 Article filtering (backend hygiene, invisible to runners)

---

## Gaps not in TODO (should be added)

- **PB flag per participant per race** — most important missing data attribute
- **Finishing time visible in feed list** — zero additional API work, high runner value
- **Year/season filter** — runners think in seasons; "my 2023" is a meaningful unit
- **Show cluster count on map** — intentional decision to hide numbers is wrong; 12 races in Japan vs. 2 in Norway should be visually distinct
- **Elevation gain per race** — critical for ultras and mountain marathons; not in data model at all
