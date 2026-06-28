# Brand Guide — Matthew Maynes

## Brand Identity

The Matthew Maynes brand reflects a hands-on engineering leader who solves problems, builds things, and leads by example — but also someone grounded in nature, family, and life outside of code. The visual identity should feel:

- **Professional** — Credible and polished, appropriate for an engineering director
- **Technical** — Clearly from someone who builds things, not just manages
- **Approachable** — Warm and human, not cold or corporate
- **Grounded** — Connected to nature, family, and the real world
- **Clean** — Minimal, focused, no visual noise

## Logo / Wordmark

A clean wordmark using the primary heading font:

```
MATTHEW MAYNES
```

- All caps, generous letter-spacing
- Optional: a subtle monogram `MM` mark for favicon and small contexts
- The monogram can use a geometric/minimal style — two interlocking or side-by-side M letterforms

## Color Palette — "Harbor"

The palette is built on the [`@rogueoak/roots`](https://www.npmjs.com/package/@rogueoak/roots)
design tokens. Roots ships a nature theme (moss / bark / stone / amber); this site re-points the
semantic roles onto a bluer + slate set — **Harbor** — while keeping a warm gold accent so it
stays inviting, not corporate-cold. The override lives in `src/styles/theme-harbor.css`; components
read only the semantic roles, so light/dark theming needs no per-component code.

### Brand Ramps

| Ramp                | Role     | 50 → 950 (600 = default)        |
|---------------------|----------|---------------------------------|
| Harbor (ocean blue) | primary  | `#eef3f8` … `#2c557b` … `#14222f` |
| Slate (cool gray)   | neutrals | `#f6f7f9` … `#586475` … `#1a1f25` |
| Amber (warm gold)   | accent   | inherited from Roots (`#cf9343` / `#c2873b`) |

### Semantic Roles (light)

| Token                  | Hex       | Usage                                          |
|------------------------|-----------|-------------------------------------------------|
| `--color-primary`      | `#2c557b` | Buttons, links, active nav, brand blue          |
| `--color-primary-hover`| `#254765` | Hover/pressed primary                           |
| `--color-accent`       | `#cf9343` | CTA fills, featured highlights (warm gold)      |
| `--color-accent-strong`| `#7d5326` | Accent text/icon/border on light (AA-safe)      |
| `--color-bg`           | `#f6f7f9` | Page canvas (cool off-white)                    |
| `--color-surface`      | `#ffffff` | Cards, panels                                   |
| `--color-text`         | `#2a313a` | Primary text, headings (slate, warm-cool)       |
| `--color-text-muted`   | `#586475` | Secondary / body copy                           |
| `--color-border`       | `#dce0e7` | Hairline borders, dividers                      |

Secondary (`bark`, warm brown) and the status roles (success / warning / danger / info) are
inherited from Roots unchanged. Dark mode re-maps every role onto deep slate via the `.dark` class.

### Rationale

- Harbor blue reads professional and director-credible without going icy or "enterprise SaaS"
- Slate neutrals are cooler than Roots' warm stone, giving the structure a calmer, modern base
- The warm gold accent (kept from Roots) carries the "approachable and human" side of the brand
- Built on shared tokens, so the whole UI re-themes (and supports dark mode) from one CSS layer

## Typography

### Headings: DM Sans

- Friendly geometric sans-serif with slightly rounded terminals
- Feels approachable without being childish — warmer than Inter
- Weight: 700 (Bold) for h1/h2, 600 (Semi-Bold) for h3/h4

### Body: DM Sans

- Same family for consistency
- Weight: 400 (Regular) for body, 500 (Medium) for emphasis
- Line-height: 1.7 for comfortable reading

### Code: JetBrains Mono

- Monospace font for code blocks and inline code
- Weight: 400
- Ligatures enabled

### Font Scale

```
h1: 2.5rem (40px)  — Page titles
h2: 2rem (32px)    — Section headings
h3: 1.5rem (24px)  — Subsection headings
h4: 1.25rem (20px) — Card titles
body: 1rem (16px)  — Body text
small: 0.875rem (14px) — Captions, metadata
```

## Spacing & Layout

- Max content width: `768px` for blog posts (optimal reading width)
- Max page width: `1200px` for wider pages (projects grid, home)
- Consistent padding: `1.5rem` (24px) on mobile, `3rem` (48px) on desktop
- Section spacing: `4rem` (64px) between major sections

## Components Style Guide

### Cards (Projects, Blog Posts)

- `--color-surface` background on the `--color-bg` canvas
- Subtle border (`1px solid var(--color-border)`)
- Rounded corners (`--radius-md`, 8px)
- Gentle box shadow on hover (`--shadow-md`)
- Padding: `--space-6` (1.5rem)

### Buttons / Links

- Primary links: `--color-primary` (Harbor blue), underline on hover
- CTA buttons: `--color-accent` (warm gold) fill with `--color-accent-foreground` text, `--radius-md`
- Subtle transition on hover (`--duration-base`, 0.2s)

### Tags

- Small pills with `--color-muted` background and `--color-primary` text
- Warm variant: `--color-accent`-tinted background with `--color-accent-strong` text
- Rounded corners (`--radius-full`) for full pill shape
- Used for blog post tags and project tech stacks

### Navigation

- Clean top bar: `--color-text` on `--color-surface`
- Active page indicator: `--color-accent` (warm gold) underline
- Sticky on scroll (optional)

## Photography & Media

- Use professional, clean imagery where needed
- Nature photography from the property (forests, trails, seasons) as hero backgrounds or section dividers
- Subtle nature textures (leaf patterns, wood grain) can be used as design elements at low opacity
- Code screenshots should use a dark theme matching the code highlighting
- Photos of Sasha (the golden doodle) welcome as personality touches

## Voice & Tone (for written content)

- **Direct** — Lead with the point, then explain
- **Technical but accessible** — Don't dumb it down, but don't gatekeep
- **Personal** — Write in first person, share real experiences and life outside of work
- **Grounded** — Draw metaphors from nature, building, and hands-on work when it feels natural
- **Concise** — Respect the reader's time

## Favicon & Open Graph

- Favicon: `MM` monogram on Harbor blue (`--color-primary`) background
- Open Graph image: Name + title + brand colors for social sharing
- Format: `matthewmaynes.com — Engineering Leader & Builder`

## The "Whole Person" Principle

The site should feel like it belongs to a complete person, not just a resume. The technical and personal sides should coexist naturally:

- The **Home** page hero can feature a nature photo from the property as a background
- The **About** page includes a personal section alongside the professional one
- **Blog** topics span engineering, leadership, nature, fitness, and life — all welcome
- Seasonal touches are encouraged (e.g., the hero image could rotate with the seasons)
- The overall effect: someone you'd want to work with *and* have a conversation with
