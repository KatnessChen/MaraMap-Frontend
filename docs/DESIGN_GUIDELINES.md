# MaraMap Design Guidelines

This document outlines the core design principles for the MaraMap project, ensuring a consistent, accessible, and high-quality user experience.

## 1. Mobile First
- **Core Philosophy:** Design and develop for mobile screens first. The primary use case is viewing the log on a phone during or after a trip/run.
- **Implementation:** Use Tailwind's default mobile-first breakpoints. Start with un-prefixed utilities for mobile, and use `md:`, `lg:` for larger screens.
- **Interactions:** Prioritize touch-friendly interactions (large tap targets, swipe gestures) over hover effects, though hover states should be provided for desktop users.

## 2. Full RWD (Responsive Web Design) Support
- The application must scale gracefully from small mobile screens (320px) up to large desktop monitors.
- Use fluid typography (`clamp()`, viewport units) and flexible grid/flexbox layouts.
- Do not just stretch mobile designs; utilize the extra space on desktop to show more context or re-arrange elements for better reading flow.

## 3. Target Audience: The Active Senior Explorer
**Profile:** Traditional Chinese speakers, age 65+, passionate about world travel, marathons, and hiking.

This demographic requires specific accessibility considerations:

- **Typography & Readability:**
  - **Base Font Size:** Must be comfortably large. Start with a base of `16px` or `18px`, avoiding anything smaller than `14px` for critical information.
  - **Line Height:** Generous spacing (`1.6` to `1.8`) to prevent text from blending together, especially for Traditional Chinese characters which are dense.
  - **Font Choice:** Use highly legible, familiar fonts. `Noto Sans TC` (思源黑體) for UI/Modern feel, `Noto Serif TC` (思源宋體) for long-form reading. Avoid overly stylized or decorative fonts for body text.

- **Contrast & Visibility:**
  - Maintain high contrast ratios (WCAG AA or AAA) between text and background. 
  - Be careful with "Dark Modes" (like the Cyberpunk theme) — ensure the text isn't too dim (avoid `#888` on `#000`, push it to `#CCC` or `#FFF`).

- **Interaction & Navigation:**
  - **Tap Targets:** Minimum `44x44` pixels for all clickable elements (buttons, links, theme switchers). Provide ample spacing between clickable items to prevent accidental taps.
  - **Clarity over Cleverness:** Avoid overly complex "hidden" navigation or gestures that require discovering. Icons must be paired with text labels where the meaning isn't universally obvious.
  - **Animation:** Keep animations smooth and purposeful. Avoid rapid flashing, intense parallax, or fast-moving elements that might cause motion sickness or distraction. "Design Spells" should be elegant, not overwhelming.

## 4. Design Language: "Data-Driven Journal"
- **No Images:** Rely on typography, layout, CSS geometry, and data visualization (charts, maps, numbers) to tell the story instead of photos.
- **Semantic Theming:** The UI must support seamless theme switching (e.g., Cyberpunk, Earthy, Minimal) via CSS variables to cater to different moods or specific race environments without changing the underlying DOM structure.
