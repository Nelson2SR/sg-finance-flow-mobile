# UI Design System — Liquid Glass (Dark Neon)

Source of truth for the dark-gradient-neon visual language used across all
screens. When in doubt, follow the recipes here rather than introducing
ad-hoc colors, spacings, or shadow values.

## Direction in one paragraph

Near-black matte base. Cards float on it as slightly elevated dark surfaces
with a faint hairline border and a soft top-edge gradient. The coral brand
color (`#E0533D`) is the singular neon accent — used sparingly for CTAs,
focus rings, the active tab indicator, and the gauge arc. Income/positive
states use mint (`#5BE0B0`); spend/danger uses rose (`#FF5C7C`). Text sits
on a four-step opacity ramp over white. Motion is subtle: 200ms fade-and-
press for interactive elements, no decorative animation.

## Tokens

All tokens live in `tailwind.config.js` under `theme.extend.colors`.
Reference them via NativeWind `className` (`bg-surface-1`,
`text-text-high`, `border-hairline`) rather than hardcoding hex values.

### Surfaces (dark stack)

| Token | Value | Use |
|---|---|---|
| `surface-0` | `#05060A` | Root background. Every screen's outermost `<View>`. |
| `surface-1` | `#0B0C12` | Header / nav bar background under blur. |
| `surface-2` | `#15171F` | Card surface (transactions, vaults, charts). |
| `surface-3` | `#1E212B` | Pressed state, modal sheet, input field. |
| `hairline` | `rgba(255,255,255,0.06)` | 1px card borders. |

### Text (opacity ramp on white)

| Token | Value | Use |
|---|---|---|
| `text-high` | `rgba(255,255,255,0.96)` | Display numbers, screen titles, primary content. |
| `text-mid` | `rgba(255,255,255,0.62)` | Body text. |
| `text-low` | `rgba(255,255,255,0.38)` | Captions, labels, helper text. |
| `text-dim` | `rgba(255,255,255,0.18)` | Placeholders, disabled. |

### Accents

| Token | Value | Use |
|---|---|---|
| `accent-coral` | `#FF6B4A` | Primary CTAs, active tab, gauge arc on dark. |
| `accent-mint` | `#5BE0B0` | Income, success, confirm. |
| `accent-rose` | `#FF5C7C` | Spend, danger, destructive. |
| `accent-amber` | `#FFB547` | Warning thresholds (50–80% budget). |

Existing `brand-500` / `financy-*` tokens stay for backwards compatibility,
but new code reaches for the `accent-*` family because they're tuned for
contrast on `surface-0`.

### Shadows / glows

| Token | Definition |
|---|---|
| `shadow-glow-coral` | `0 0 24px rgba(255, 107, 74, 0.45)` |
| `shadow-glow-mint` | `0 0 24px rgba(91, 224, 176, 0.35)` |
| `shadow-card` | `0 8px 24px rgba(0, 0, 0, 0.6)` |

Shadows are only ever used on dark surfaces and only on the primary CTA,
the active card, or the gauge ring. Don't stack them.

## Type ramp

| Style | Size / Weight / Tracking | Token |
|---|---|---|
| Display | 40 / 300 / -0.02em | `text-[40px] font-jakarta-light tracking-tighter` |
| Title | 22 / 700 / -0.01em | `text-2xl font-jakarta-bold` |
| Body | 14 / 400 | `text-sm font-jakarta` |
| Caption | 10 / 700 / +0.18em / uppercase | `text-[10px] font-jakarta-bold uppercase tracking-widest` |

Display is for hero numbers (vault balance, safe-to-spend). Title is for
the screen title in the header. Caption is the small uppercase labels above
every value. No new sizes outside this ramp without updating this doc.

## Spacing

- Screen edge padding: `px-6` (24px).
- Card padding: `p-5` (20px) or `p-6` (24px) for hero cards.
- Card radius: `rounded-[24px]` for cards, `rounded-[20px]` for rows,
  `rounded-full` for chips and CTAs.
- Section gap: `mb-8` between major sections, `gap-3` between items.

## Components

Primitives live in `components/ui/` and are the only correct way to render
a card, button, or surface. Don't compose from raw `<View>` + `bg-*` again.

### `<Surface>`

The root background wrapper for every screen. Renders `surface-0` and a
subtle radial coral glow behind the header so the screen has the design
system's signature top-edge halo.

```tsx
<Surface>
  <ScreenHeader title="Analytics" />
  ...
</Surface>
```

### `<GradientCard>`

Card surface used for vaults, charts, and any elevated content. Renders:
- `surface-2` base with a 12% white-to-transparent gradient on the top
  edge (the "hairline glow")
- 1px `hairline` border
- `shadow-card` elevation

Props:
- `accent` (optional) — when set, the top gradient is tinted with the
  accent color instead of white, producing a colored halo. Used on the
  active vault card and the safe-to-spend gauge.

### `<NeonButton>`

Primary CTA. Solid `accent-coral` background, `shadow-glow-coral`
elevation, scale-down active state. Secondary variant available for
non-primary actions (transparent with `hairline` border).

```tsx
<NeonButton onPress={onSave}>Connect Vault</NeonButton>
<NeonButton variant="secondary" onPress={onSkip}>Skip</NeonButton>
```

### `<ScreenHeader>`

Standardized top bar: uppercase caption + title on the left, optional
action button on the right. Sits inside `<Surface>`'s SafeAreaView.

## Motion

- Press: `active:scale-95` on all buttons and tappable cards. ~150ms.
- Tab switch: react-navigation default fade. Don't override.
- Skeleton on initial data load: 1.5s pulse on `surface-2`. Never use a
  blocking spinner per `CLAUDE.md`'s "Empty States & Skeletons" rule.

## Screens

Each screen reads from these components and tokens. Concrete recipes:

### Login / Vault Unlock

- `<Surface>` with the coral halo intensified.
- Centered logo tile (`accent-coral` fill, `shadow-glow-coral`).
- Display title.
- `<GradientCard>` holding the form.
- Inputs: `surface-3` bg, `hairline` border, focus → `accent-coral` border.
- `<NeonButton>` to submit.

### Home / Dashboard

- `<Surface>`.
- Horizontal carousel of `<GradientCard accent="coral">` per vault. The
  active card uses the accent variant, inactive cards are plain.
- Quick actions: one `<NeonButton>` for "Magic Scan", one secondary for
  "Add Entry".
- Activity list: `<GradientCard>` per transaction row.

### Transactions / Activity

- `<Surface>`.
- Filter chips: `surface-2` default → `accent-coral` selected, with glow.
- Vault chips: same recipe.
- Transaction rows in `<GradientCard>` form.
- Swipe-to-delete reveals an `accent-rose` action panel.

### Analytics

- `<Surface>`.
- Gauge in a `<GradientCard accent="coral">` hero. Arc color shifts by
  ratio: `accent-mint` → `accent-amber` → `accent-rose`.
- Cashflow bars: `accent-mint` income, `accent-rose` spend, inside a
  `<GradientCard>`.
- Budget rows and subscription rows in `<GradientCard>`.

### Tab bar

- Bottom bar background: `surface-1` with a translucent blur.
- Active tint: `accent-coral`. Inactive: `text-low`.
- Center "Copilot" action: large `accent-coral` rounded tile with
  `shadow-glow-coral`.

## When to break the rules

The system is intentionally restrictive: one accent (coral), one positive
(mint), one danger (rose). If you need something the system doesn't
provide, update this doc first, add the token, then use it. New tokens
without a corresponding entry here are technical debt.
