---
name: build_huslt_temp
description: >
  Build flexible, config-driven business landing-page templates (Hustel
  template system) for local businesses — cafés, restaurants, salons,
  clinics, gyms, shops, offices. Use this skill whenever the user wants to
  create a business website template, scaffold a landing page, redesign a
  Hustel template, or turn a business idea into a reusable multi-section
  site — even if they don't say the word "template". Also use it when the
  user asks for multilingual or RTL-ready marketing pages, or when they
  want a site whose sections can be reordered, removed, or recombined per
  client. The tech stack is always chosen by the user at invocation time;
  this skill defines the design decisions, not the framework.
---

# build_huslt_temp — Hustel Business Template System

You are building a **reusable template** that will be re-themed and refilled
for many different clients of the same business type. Everything you write
should be judged by one question: *how painful is it to adapt this for the
next client?* A template with hardcoded content is a finished website, not a
template.

## Step 0: Ask before building

Never assume the stack or the languages. Before writing any code, get from
the user:

1. **Tech stack** (required) — vanilla HTML/CSS/JS, React, Next.js, Vue,
   Tailwind, etc. The design system in this skill translates to any of
   them: CSS custom properties become Tailwind theme tokens, React props,
   or whatever the stack prefers. Ask; don't guess.
2. **Business type** — this decides which sections exist. A café needs a
   menu and opening hours; a salon needs services + booking; a gym needs
   plans + trainers.
3. **Languages** — i18n scaffolding is always included (see Step 4), but
   confirm the language set and priority order (e.g., Arabic first, then
   French, then English).
4. **Primary action** — the ONE thing visitors should do: visit / order /
   reserve / book / call. Every CTA on the page uses identical wording for
   this action.

If the user gives all of this up front, skip the questions.

## Step 1: Structure — flexible sections, not a fixed page

Build the page as a list of self-contained `<section>` blocks. Each section:

- Owns everything it needs: header (kicker → title → subtitle), content
  grid, and its own styles.
- Is marked with a numbered comment banner so blocks are easy to find:
  `<!-- ============ 3. FEATURES ============ -->`
- Must be **removable and reorderable without breaking anything**: JS never
  depends on section order, no section references another's DOM, shared
  styles live at component level (`.section`, `.section-kicker`,
  `.container`), not per-instance.
- Repeatable blocks inside a section (menu items, gallery figures, feature
  cards, testimonials) are marked with template comments showing how to
  repeat them:
  `<!-- {{gallery}} — repeat figure.gallery-item per photo -->`

Pick sections from this library based on business type (order is a starting
point, not law):

| Section | Use for |
|---|---|
| Hero (split layout) | every business |
| Marquee/trust ribbon | adds motion + brand energy; skip for formal sectors |
| Features/ambiance cards | what makes THIS business unique (Wi-Fi speed, outlets, parking…) |
| Menu/services/pricing list | anything sellable; dotted-leader rows beat card grids for readability |
| Gallery (bento grid) | visual businesses (food, hair, interiors, gyms) |
| Reviews/testimonials | any business with repeat customers |
| Hours + location + map | walk-in businesses |
| FAQ | clinics, offices, services with paperwork or policies |
| Team/trainers/staff | gyms, salons, clinics |

When the business needs a deep subpage (full menu, service catalog), create
it as a second page sharing the same stylesheet and header — not a modal or
an endless scroll.

## Step 2: Design system — branding lives in config, not code

All brand decisions are **data**, stored in the template's `config.json`
under a `theme` key (a standalone `theme.json` is fine for bigger setups):

```json
{
  "theme": {
    "colors": {
      "primary": "#241a11", "accent": "#d0662f",
      "bg": "#faf4ea", "surface": "#fffdf8",
      "text": "#241a11", "text_muted": "#7d6d5c", "border": "#e8dcc9"
    },
    "fonts": { "heading": "Fraunces", "body": "Outfit" },
    "radius": "18px"
  }
}
```

The build/render layer injects these into whatever mechanism the chosen
stack uses — CSS custom properties in `:root` for static sites, Tailwind
theme extension, styled-components variables, etc. For static HTML keep a
`:root` block in the stylesheet but generate its values from config and say
so in a comment (`/* values from config.json → theme */`). Re-theming a
client must never require touching component code: change the JSON,
re-render, done.

Zero hardcoded colors, radii, or shadows anywhere else. If a one-off color
seems necessary (e.g., status green/red), add it to `theme.colors` instead
of inlining it.

### Design language (the Hustel look)

These are the recurring design decisions that make templates feel finished
rather than generated:

- **Type pairing**: characterful display serif (Fraunces-style) for headings
  + clean geometric sans for body, loaded from Google Fonts. Fluid sizes via
  `clamp()`, tight letter-spacing on big headings.
- **Section headers**: tiny uppercase accent-colored kicker → big heading →
  muted one-line subtitle, centered (or left-aligned in split layouts).
- **Warm palettes**: cream/espresso/terracotta territory beats blue-purple
  defaults. Pick colors from the actual business world (coffee = browns,
  plants = greens, bakery = warm yellows).
- **Motion, restrained**: hover lifts (`translateY(-2~4px)` + shadow),
  animated nav underlines, one playful element max (tilted marquee ribbon,
  pulsing open-status dot). Always wrap in `prefers-reduced-motion`.
- **Shapes**: generous border-radius (16–18px), occasional signature shape
  (arched hero image), dashed borders for list dividers.
- **Buttons**: pill-shaped; primary filled, secondary outlined, ghost text
  link with arrow icon that nudges on hover.
- **Header**: sticky, blurred glass background, inline open/closed status
  chip where relevant, language switcher.
- **Mobile**: single column, both CTAs side-by-side in one row (compact
  padding + fluid font so the longest translation fits), sticky bottom CTA
  bar that appears after the hero and hides near the footer — mobile only.

## Step 3: Content AND copy live in separate files

Keep three kinds of content out of the markup, each in its own home:

1. **Business data** → `config.json`: name, contact info, links, hours,
   menu/service items (with prices), gallery, testimonials, features,
   theme. This is what changes per client.
2. **Copy/translations** → one file per language, e.g.
   `locales/ar.json`, `locales/fr.json`, `locales/en.json`. Every UI string
   on the page — nav labels, hero headline, section titles, button labels,
   status text, even `<title>` and meta description — is a key here. The
   markup carries only keys (`data-i18n="hero_title"`) plus a source-language
   fallback so pages preview before JS runs.
3. **Structure** → the HTML/components themselves contain no client copy
   and no brand values at all.

The payoff: a new client = new config; a new market = new locale file;
a redesign = markup only. None of the three touch each other.

## Step 4: i18n + RTL (always included)

Every template ships multilingual-ready, even if launched with one string
set:

- Mark every translatable string with `data-i18n="key"` (use
  `data-i18n-html` when the value contains markup like an `<em>`). The
  values live in `locales/<lang>.json` files (see Step 3), never in the
  dictionary-in-JS — copy edits must not require touching code.
- Load the `locales/<lang>.json` files at runtime (or bundle per language);
  a lookup helper falls back gracefully when a key is missing. Persist
  manual choice in `localStorage` (guarded with try/catch); auto-detect
  from `navigator.languages` scanning the user's priority order.
- Set `document.documentElement.lang` AND `dir="rtl"` for RTL languages.
  Write CSS with logical properties (`margin-inline-end`, `text-align:
  end`, `inset-inline-end`) from the start so RTL mostly works for free.
- Flip directional icons under `[dir="rtl"]`; disable italics for Arabic
  script (use color emphasis instead); load a proper Arabic font (Tajawal-
  style) by overriding the font custom properties under `html[lang=…]`.
- Language switcher: small segmented control in the header, active state
  highlighted.

## Step 5: Behavior hooks — a stable JS contract

Interactive behavior reads from stable, documented class/id names so markup
can be reshuffled freely:

- `.js-primary-cta` on every CTA; each contains an icon plus a
  `<span class="js-label">`. JS writes the label into the span only — this
  preserves icons across updates and translations.
- Named ids for live elements: `#open-status`, `#hours-table`,
  `#sticky-cta`, `#nav-toggle`, `#year`. Open/closed status derives from
  config hours and highlights today's row.
- All strings rendered by JS come from the i18n dictionary, never
  hardcoded.

## Step 6: Placeholders & polish details

- Images are optional at template time: give every image position an
  aspect-ratio-sized placeholder slot (subtle gradient + dot pattern) so
  missing assets never break layout.
- Accessibility is part of the design, not a patch: semantic landmarks,
  aria-labels on icon-only links, visible `:focus-visible` rings, alt-text
  comments for real photos, `aria-live` status regions.
- Validate before delivering: balanced tags, matching braces, every
  `data-i18n` key present in the dictionary for every language, all JS
  hooks resolve against the markup.

## Output checklist

Before saying "done", verify:

- [ ] Tech stack matches exactly what the user specified
- [ ] Colors/fonts/radius come from `config.json → theme`; no hardcoded brand values in code
- [ ] All copy lives in `locales/<lang>.json`; all business data in `config.json`
- [ ] Sections are commented, self-contained, reorderable
- [ ] Content swappable without touching structure
- [ ] i18n attributes + locale files + switcher + RTL styles present
- [ ] Primary-action wording identical on every CTA
- [ ] Mobile: inline CTA row, compact hero type, sticky bar (mobile-only)
- [ ] Reduced-motion, focus-visible, placeholders, validation done





