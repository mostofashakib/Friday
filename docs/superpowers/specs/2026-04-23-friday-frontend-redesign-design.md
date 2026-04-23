# Friday Frontend Redesign — Design Spec

**Date:** 2026-04-23
**Scope:** Full frontend — landing page, auth pages, interview setup, interview session, report page
**Direction:** Premium Glassmorphism

---

## 1. Design Decisions

| Axis | Decision |
|---|---|
| Overall direction | Premium Glassmorphism |
| Background | Mesh gradient + noise texture |
| Card treatment | Gradient border (1px gradient wrap + dark glass interior) |
| Hero centerpiece | Mini report dashboard card |
| Implementation strategy | Design system first (tokens → pages) |

---

## 2. Design System (globals.css)

### 2.1 Background System

A `position: fixed` full-viewport layer set on `body` — all pages inherit it automatically. No per-page background declarations.

```css
body::before {
  content: '';
  position: fixed; inset: 0; z-index: -2; pointer-events: none;
  background:
    radial-gradient(ellipse 60% 50% at 15% 10%, rgba(10,132,255,0.18) 0%, transparent 55%),
    radial-gradient(ellipse 50% 60% at 85% 5%,  rgba(94,92,230,0.15) 0%, transparent 55%),
    radial-gradient(ellipse 70% 40% at 50% 90%, rgba(10,132,255,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 40% 50% at 0%  60%, rgba(94,92,230,0.10) 0%, transparent 50%),
    #080810;
}
body::after {
  /* noise texture — reuse existing fractalNoise SVG data URI already in globals.css */
  content: '';
  position: fixed; inset: 0; z-index: -1; pointer-events: none; opacity: 0.038;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

### 2.2 Card System

Two variants:

**`.card-gb`** — Primary. Used for hero centerpiece, overall score card, auth forms.
```css
.card-gb {
  border-radius: 14px;
  padding: 1px;
  background: linear-gradient(135deg,
    rgba(10,132,255,0.38) 0%,
    rgba(94,92,230,0.28) 50%,
    rgba(10,132,255,0.12) 100%
  );
}
.card-gb > * {
  border-radius: 13px;
  background: rgba(6,6,16,0.88);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}
.card-gb:hover {
  background: linear-gradient(135deg,
    rgba(10,132,255,0.55) 0%,
    rgba(94,92,230,0.40) 50%,
    rgba(10,132,255,0.22) 100%
  );
}
```

**`.card-gb-subtle`** — Secondary. Used for feature cards, setup panels, competency cards, transcript.
```css
.card-gb-subtle {
  border-radius: 14px;
  padding: 1px;
  background: linear-gradient(135deg,
    rgba(10,132,255,0.18) 0%,
    rgba(94,92,230,0.12) 50%,
    rgba(10,132,255,0.06) 100%
  );
}
.card-gb-subtle > * {
  border-radius: 13px;
  background: rgba(6,6,16,0.82);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
.card-gb-subtle:hover {
  background: linear-gradient(135deg,
    rgba(10,132,255,0.32) 0%,
    rgba(94,92,230,0.22) 50%,
    rgba(10,132,255,0.12) 100%
  );
}
```

### 2.3 Button System

**`.btn-primary`**
```css
.btn-primary {
  background: #0A84FF;
  color: #fff;
  font-weight: 700;
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgba(10,132,255,0.3), 0 4px 24px rgba(10,132,255,0.38);
  transition: box-shadow 0.2s, transform 0.15s;
}
.btn-primary:hover {
  box-shadow: 0 0 0 1px rgba(10,132,255,0.5), 0 8px 32px rgba(10,132,255,0.5);
  transform: translateY(-1px);
}
.btn-primary:active { transform: scale(0.97); }
```

**`.btn-ghost`**
```css
.btn-ghost {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(245,245,247,0.7);
  border-radius: 999px;
  transition: background 0.2s, border-color 0.2s;
}
.btn-ghost:hover {
  background: rgba(255,255,255,0.09);
  border-color: rgba(255,255,255,0.18);
}
```

### 2.4 Typography Tokens

```css
.text-muted  { color: rgba(245,245,247,0.42); }
.text-dimmer { color: rgba(245,245,247,0.25); }
.text-accent { color: #0A84FF; }

/* Large headings: tighter tracking */
.heading-xl {
  font-size: clamp(3.2rem, 8vw, 6rem);
  font-weight: 800;
  letter-spacing: -0.045em;
  line-height: 1.04;
}
.heading-lg {
  font-size: clamp(1.9rem, 4vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.08;
}
```

### 2.5 Utility Classes

| Class | Purpose |
|---|---|
| `.tag-blue` | `background: rgba(10,132,255,0.1); border: 1px solid rgba(10,132,255,0.22); color: rgba(10,132,255,0.9); padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 600` |
| `.glow-blue-sm` | `box-shadow: 0 4px 20px rgba(10,132,255,0.35)` |
| `.glow-blue-lg` | `box-shadow: 0 16px 60px rgba(10,132,255,0.22)` |
| `.glass-surface` | Frosted surface for dropdowns/overlays |
| `.animate-float` | `float 7s ease-in-out infinite` (hero card) |

### 2.6 New Keyframes

```css
@keyframes float {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-12px); }
}
@keyframes shimmer-gb {
  0%   { background-position: 0% center; }
  100% { background-position: 200% center; }
}
/* Note: elements using shimmer-gb must also set background-size: 200% auto */
```

---

## 3. Landing Page

### Navbar
- Scrolled state: `backdrop-filter: blur(32px)` + gradient border on bottom edge
- "Start interview" → `.btn-primary` with glow
- Logo icon: `box-shadow: 0 4px 14px rgba(10,132,255,0.4)`

### Hero
- Full viewport, mesh background shows through
- Eyebrow: `.tag-blue` pill
- `h1`: `.heading-xl` with white-to-60%-white gradient text fill
- CTAs: `.btn-primary` + `.btn-ghost` in a flex row
- Centerpiece: Mini Report Dashboard in `.card-gb`, `animate-float`, `glow-blue-lg` beneath it
  - Shows: overall score (large numeral, color-matched), competency bars, one coaching note line
  - Width ~340px, centered below CTAs

### Features Section
- All 6 cards: `.card-gb-subtle`
- Icon containers: `background: linear-gradient(135deg, {color}20, {color}10)` per feature accent color
- Hover: gradient border brightens, `translateY(-4px)`, pure CSS
- Section heading: `.heading-lg`

### How It Works
- 3 step cards: `.card-gb-subtle`
- Step numbers: `clamp(3.5rem, 6vw, 5rem)`, gradient text `rgba(10,132,255,0.3) → rgba(94,92,230,0.2)`
- Connecting line: animated `shimmer-gb` gradient, 3s cycle

### CTA Section
- Container: `.card-gb` (full primary treatment)
- Top accent line: `shimmer-gb` animated gradient
- `glow-blue-lg` beneath the card
- Button: `.btn-primary` (large, full padding)

### Footer
- Consistent with token updates — no structural change

---

## 4. Auth Pages (Login + Signup)

- Full-screen centered layout, mesh background visible
- Form container: `.card-gb` — same gradient border treatment as hero card
- Inputs: `background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1)` with blue glow on focus
- Submit button: `.btn-primary` full-width
- Back-click-to-dismiss behaviour preserved
- "No account? Sign up" link: `.text-accent`

---

## 5. Interview Setup Page

- Centered layout, max-width 560px, mesh background
- Section panels (Type, Role, Difficulty): `.card-gb-subtle`
- Selected type row: inner surface `background: rgba(10,132,255,0.08)`, gradient border brightens to stronger blue
- Difficulty pills: selected → `.btn-primary` style; unselected → `.btn-ghost` style
- Start button: full-width `.btn-primary` with `glow-blue-sm`
- Role input: updated to match new input token style

---

## 6. Interview Session Page

- All surface panels: `.card-gb-subtle`
- Score display: large numeral at `3rem`, color `#30D158` (≥4), `#FF9F0A` (≥3), `#FF453A` (<3), with matching `box-shadow` glow
- Listening indicator: pulsing blue dot + three animated bars (waveform style)
- No layout changes — functional structure preserved

---

## 7. Report Page

- Overall score card: `.card-gb` (primary)
  - Score numeral: `5.5rem`, bold, color-matched with glow beneath
  - Progress bar: `8px` tall, gradient fill, smooth transition on mount
- Competency breakdown card: `.card-gb-subtle`
  - Bars: `6px` height, gradient fill per score range, `border-radius: 3px`
- Coaching insights card: `.card-gb-subtle` with purple-tinted gradient border — `linear-gradient(135deg, rgba(94,92,230,0.32) 0%, rgba(10,132,255,0.18) 50%, rgba(94,92,230,0.1) 100%)`
- Transcript card: `.card-gb-subtle`
- Action buttons: "Practice again" → `.btn-primary`, "Back to home" → `.btn-ghost`

---

## 8. What Does Not Change

- All API calls, state management, hooks
- Component file structure and routing
- TypeScript types and props interfaces
- Technical interview page layout (functional — surface styles only)
- Existing `input-apple` utility (merged into new input token)
- Supabase auth logic

---

## 9. Animation Budget

| Element | Animation | Notes |
|---|---|---|
| Hero card | `float 7s ease-in-out infinite` | Subtle, non-distracting |
| CTA border | `shimmer-gb 4s linear infinite` | Barely perceptible |
| HowItWorks connecting line | `shimmer-gb 3s linear infinite` | |
| Listening indicator | `glow-pulse 1.5s ease-in-out infinite` | Existing |
| All hover states | CSS `transition` only | No additional keyframes |

---

## 10. Constraints

- `backdrop-filter` already used — no regression
- Gradient border via `padding: 1px` trick — universally supported
- Fixed mesh background — pure CSS, no images, no JS
- Noise texture — inline SVG data URI, loads instantly
- No colour-only information — all score states retain text labels
- All existing focus/accessibility states preserved
