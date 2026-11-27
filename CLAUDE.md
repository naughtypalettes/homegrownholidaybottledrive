# Homegrown Holiday Bottle Drive: landing page build brief

You're building the public bottle drive page for **Homegrown Arts & Media Collective**, a non-profit in Alberta. The page sits on Homegrown's website and is also the front end of the donor sign-up web app. Money raised goes to mental health supports for independent artists in Alberta.

`index.html` in this folder is the **approved visual reference**: a hi-fi mockup with animations, exported from the design canvas. Match its look, copy, layout and motion. Its links point to `#` and its form doesn't submit; wiring those up is the job.

Owner: Amar Elkaz (Marketing Coordinator, Homegrown). Ask him before making any decision marked **ASK** below.

---

## 1. What's in this folder

| File | What it is |
| --- | --- |
| `index.html` | Full page: markup, all CSS in one `<style>` block, no JS. All styling is inline styles; the classes starting `hg-` exist only for animation. |
| `assets/tree.png`, `snowman.png`, `photographer.png`, `gift.png`, `gift-small.png` | Pixel-art characters from the launch post. Always render them with `image-rendering: pixelated`. |
| `assets/homegrown-logo.png` | Pixel Homegrown wordmark, light colour for dark backgrounds. Used in the header only. |

The hero's starfield, the bunting and the city skyline are **inline SVG** in `index.html` (sharp-edged pixel rectangles). Keep them as SVG; don't turn them into images.

## 2. Before you start (ASK)

1. **Platform.** What does Homegrown's site run on? (WordPress, Squarespace, Wix, or something static.) This decides whether the build is a WordPress page template or block, an embed or code block, or a standalone page on a subpath such as `/bottle-drive`.
2. **Where sign-ups go.** The plan is a website form feeding a **Google Sheet**, with email sent through **Kit or Gmail**. Confirm which, and who owns the sheet.
3. Fill or keep each placeholder listed in section 7.

## 3. Design tokens

```css
--navy:   #101e37;  /* main dark background, body text on light */
--deep:   #0a1428;  /* header, footer, pixel shadows, borders */
--cream:  #f4f3da;  /* main light background, text on dark */
--snow:   #dcede9;  /* alternate light sections (Why it matters, FAQ) */
--red:    #ce5352;  /* primary buttons, eyebrow labels; white text only at ≥20px bold */
--yellow: #edbe69;  /* accents on navy, key facts strip, progress bar */
--blue:   #5595a6;  /* decoration only, never behind body text */
--green:  #123f3c;  /* "Where the money goes" section, step 4 block */
--ink-muted: #33405a; /* secondary text on cream or white */
```

- **Type:** `Silkscreen` (Google Fonts, 400 and 700) for headings, eyebrows, buttons and numbers. `Atkinson Hyperlegible` (400 and 700) for all body text, labels and form fields. Never set Silkscreen below 16px.
- **Signature styling:** square corners everywhere, 3px solid borders in `--deep`, and a hard offset shadow `box-shadow: 8px 8px 0 var(--deep)` (12px red offset on the booking form card). No gradients and no rounded corners.
- **Layout:** content max-width 1200px with 24px side padding; sections have 96px vertical padding. Everything reflows with `flex-wrap` or `auto-fit` grids, so the page already works at phone width. Keep it that way.

## 4. Page sections (top to bottom)

1. **Header:** logo, site nav (Bottle Drive active), "My pickup" (outline button), "Book a pickup" (red button).
2. **Hero** (navy): full-bleed starfield, bunting across the top, and a city skyline tiled full width along the bottom (340px tall). On the left: eyebrow, H1 "Your empties fund artist mental health", intro line, two buttons, and a fundraising card with a 20-block progress bar ("[$ RAISED] of our $2,500 goal"). On the right: the tree, snowman, photographer and gifts standing on the skyline.
3. **Key facts strip** (yellow): Every Thursday · Free doorstep pickup · Calgary & Red Deer · 100% to artists.
4. **How it works** `#how`: four cards (Sign up → Check your email → Bags out Thursday → We collect).
5. **Book a pickup** `#book`: the sign-up form (section 5) and a sidebar: next pickup "Thu · Dec 10", what we take, link to My pickup, link to business partners.
6. **Why it matters** (snow): research copy and three stat cards (all placeholders).
7. **Where the money goes** (green): segmented breakdown bar and legend (placeholders), plus the no-tax-receipt note.
8. **For businesses** `#partners`: perks list, a "Partner with us" button, and a six-slot partner logo grid. Hide the grid until at least 3 venues have signed on.
9. **FAQ** (snow): six `<details>` items; the first is open by default.
10. **Closing call to action** (navy): falling snow, tree and snowman, "Book a pickup" and "Share this page".
11. **Footer** (deep navy): four columns plus the non-profit and privacy line.

## 5. Booking form = the web app's sign-up step

How pickups work (this is current and replaces the older weekend-window prototype): **pickups run every Thursday**, and donors do **not** pick a date or time window. Their first pickup is the next Thursday after the weekly cutoff. The first pickup day is **Thu Dec 10, 2026**.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| name | text | yes | |
| email | email | yes | Used for every donor message. |
| address | text | yes | Seen only by the pickup team; delete after the campaign. |
| city | radio | yes | `Calgary`, `Red Deer` |
| zone | select | yes | South, North, East, West, Downtown. Calgary focus first: south, southeast, southwest and downtown. **ASK** for the final zone list. |
| bags | radio | yes | `1–2`, `3–5`, `6–10`, `10+` |
| bag_spot | select | yes | Front step, Side door, Back gate / alley, Garage pad, Other |
| frequency | radio | yes | `Every Thursday` (default) or `Just once`. This sets the donor's pickup days. |
| note | textarea | no | Message for the driver. |
| consent_pickup_emails | checkbox | yes | Must be ticked to submit (anti-spam law, CASL). Store a timestamp. |
| consent_newsletter | checkbox | no | Unticked by default; kept separate from the pickup consent (CASL). |

On submit:
1. Create a pickup code in the format `HG-XXXX`, using letters and numbers without look-alike characters (no 0/O or 1/I/L).
2. Save the row to the sheet with a status (`registered → confirmed → collected → counted`, plus `skipped` and `bags_not_out`).
3. Send the confirmation email: code, first Thursday, "bags out by [TIME], marked Homegrown".
4. Show the confirmation screen (a wireframe of it is on the canvas: code, first pickup, next steps, link to My pickup).

Follow-on screens, shown as wireframes on the canvas (build them later or alongside):
- **My pickup:** look up with code + email, then show the profile: status tracker, upcoming Thursdays with "Skip this week", past pickups with bag counts, editable details, email preferences, "Stop pickups".
- **Team and driver views:** filter by city, zone and date; mark Collected (with bag count) or Bags not out, which triggers the thank-you or rebook email; export CSV. Put these behind a login.

## 6. Animation inventory

All motion is CSS in the `<style>` block. Keep it pixel-style: `steps()` timing, small movements.

| Class | Where | Effect |
| --- | --- | --- |
| `hg-flake` (inside `hg-snow`) | Hero and closing section | Pixel snow falling (`top` animated) with a stepped sideways drift. Delays are negative so it starts mid-fall. |
| `hg-stars`, `hg-spark` | Hero | Starfield pulses its opacity; yellow plus-shaped sparkles blink. |
| `hg-sway` | Bunting | ±0.35° swing from the top edge. |
| `hg-rise` | Hero text, FAQ answers | Fade up 24px on load, staggered from 0.1s to 0.7s. |
| `hg-cell` | Progress bar | Filled blocks light up one by one, starting at 0.9s. |
| `hg-glow` | Raised amount | Yellow/cream pulse. |
| `hg-bob`, `hg-hop`, `hg-tree` | Characters | Snowman and photographer bob, gifts hop, tree lights brighten. |
| `hg-flash` | Hero art | Camera flash every 5s. |
| `hg-win` | Skyline | Warm windows switch on and off. |
| `hg-btn` | Large buttons | Lift on hover; press flat (shadow to 0) when clicked. |
| `hg-lift`, `hg-num` | White cards | Lift on hover; step number wiggles. |
| `hg-icon` | Facts strip | Icons hop in sequence. |
| `hg-blink` | "Thu · Dec 10" | Blinking red pixel dot. |
| `hg-reveal`, `hg-grow` | Section content, money bar | Scroll-linked reveal via `animation-timeline: view()` inside `@supports`; browsers without it show the content statically. An IntersectionObserver fallback is fine if you want it everywhere. |

Required: keep the `prefers-reduced-motion: reduce` rule, which stops all motion and hides snow, sparkles and flash. Keep the `hg-still` class, which does the same as a manual switch. Decorative layers stay `aria-hidden` and `pointer-events: none`.

## 7. Placeholders (never invent these)

Everything in `[BRACKETS]` is unconfirmed. Leave it visible, or make it easy to edit (CMS fields or a single config object):

- `[$ RAISED]`, `[N] households`, `[N] businesses`: update after each depot run. The goal of **$2,500** is the meeting minimum; **ASK** whether it's final.
- `[END DATE]`, `[TIME]` (bags-out time), `[CUTOFF]` (weekly sign-up cutoff).
- `[STAT]` ×3 and the research copy: from Katie's research.
- `[BUCKET 1–4]` and `[%]`: the fund breakdown from the board.
- `[CONFIRM …]` items: accepted containers, any rules for preparing them, final zones.
- `[BOTTLE DRIVE EMAIL]`, partner `[LOGO]`s. Tagline choice: "Cans for Creatives" or "Cans for Creation" (not used on the page yet).
- **Open question:** Dec 24 and Dec 31 are Thursdays (Christmas Eve and New Year's Eve). Run, move, or skip?

## 8. Rules that don't change

- Homegrown is **not a registered charity**: no tax receipts. Keep that line in the FAQ, the money section and the footer.
- Everything stays **in-house**: no SkipTheDepot and no SMS. Email only.
- Privacy: addresses and contact details go only to the pickup team and are deleted after the campaign.
- Accessibility: real `<label>`s, 44px minimum tap targets, visible focus, colour contrast of at least 4.5:1 for text (red only at ≥20px bold with white text), and `alt=""` on decorative art.

## 9. Done means

- [ ] Matches `index.html` visually at 1440px, 768px and 390px wide.
- [ ] The form validates, saves to the agreed sheet, sends the confirmation email and shows the confirmation screen.
- [ ] Both consents are stored separately, with timestamps.
- [ ] Anchor links (`#book`, `#how`, `#partners`) and "My pickup" go where they should.
- [ ] Reduced motion is respected, and no animation causes layout shift.
- [ ] Placeholders are easy to update without a code change.
