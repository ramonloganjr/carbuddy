# Design system — Material 3 Expressive

Everything visual comes from a token. No screen sets a hex value, a font size or a
corner radius directly. That is what lets the app be re-themed — dark mode, dynamic
colour, increased contrast — without touching a single screen.

Import from `@/design-system` and nowhere deeper.

---

## Colour

Colour is **generated**, never hand-picked. `@material/material-color-utilities` builds
the full Material 3 role set from a seed.

```ts
buildColorScheme({ seed: BRAND_SEED, isDark, contrastLevel });
```

Hand-picking hexes means the contrast relationships M3 promises — `onPrimary` legible on
`primary`, in both themes, at every contrast level — hold only until someone changes a
value. Generating them means they hold by construction.

**Scheme variant: `Vibrant`.** The `TonalSpot` default desaturates the brand blue
(`#0B57D0`) into a muted slate, which reads as generic. `Vibrant` keeps the hue true and
the chroma high. `Expressive` is reserved for wallpaper-derived palettes, where a
deliberate hue shift is the point.

**Depth is tonal, not shadowed.** The five `surfaceContainer*` tones carry elevation;
shadows play a supporting role. The classic alternative — translucent white over a dark
surface — washes the hue out in dark mode.

**Semantic status colours** (`success`, `warning`, `danger`, `info`) are generated as M3
custom colours from their own seeds, using the same 40/100/90/10 tone mapping, so they
sit correctly in both themes rather than being two fixed hexes.

---

## Typography

The M3 Expressive scale, plus two additions:

- **`*Emphasized` variants** — heavier and tighter, for the single dominant element on a
  screen. This is the loudest signal of the Expressive language.
- **`numeric*` variants** — `tabular-nums`. Without it, a column of costs jitters as the
  digits change width, which is very visible in the expense list and on chart axes.

Every role carries its own `maxFontSizeMultiplier`. Body text scales to 2×, because that
is where accessibility actually matters — someone with low vision needs to read the
notes on a service record. Display text is capped harder: it is already large, and
letting a 57pt headline triple pushes everything else off screen.

System fonts, not a bundled face: they respect the user's own font-weight and size
settings, render with correct optical sizing per platform, and add nothing to the
download.

---

## Motion

Springs, not fixed-duration curves. A spring settles from wherever the element currently
is, so an interrupted gesture continues naturally instead of snapping back.

Two families, and mixing them up is the usual mistake:

- **Spatial** — moves things. Slight overshoot; that overshoot is what reads as
  "expressive".
- **Effects** — changes appearance. Critically damped, because a colour that overshoots
  looks like a bug.

Material publishes springs as (damping ratio, stiffness); Reanimated wants a damping
_coefficient_. `toPhysics` converts via `c = 2ζ√(km)`. Passing the ratio straight
through as `damping` — an easy mistake, since both are called "damping" — produces a
spring roughly fifty times too loose.

**Reduced motion is honoured everywhere.** Transitions collapse to a very short
cross-fade rather than disappearing: the state change still has to be _perceptible_, it
just must not travel. Removing feedback altogether makes an interface feel broken, which
is not what the setting asks for.

---

## Shape

Expressive Material leans harder on shape than classic Material: larger radii, full
pills for actions, and **shape change as feedback**. `Pressable` morphs a component's
corner radius while held — physical give, and a signal that survives for users who
cannot easily see a subtle state-layer colour change.

---

## Accessibility

Targeting WCAG 2.2 AA. The commitments that shaped actual components:

**Never colour alone (1.4.1).** Every status renders through `StatusPill`, which pairs
colour with an icon _and_ a text label. Status in this app is consequential — an overdue
brake service, an expired policy — so the distinction has to survive colour blindness, a
greyscale screenshot, and a phone in bright sunlight.

**Charts have real text alternatives.** `describeSeries` produces a sentence carrying
what the picture carries: range, direction, where the extremes sit. It is the
`accessibilityLabel` _and_ the visible caption, because it is useful either way.

**Touch targets are 48dp minimum (2.5.8).** `Pressable` enforces it; controls that look
smaller keep the hit area via `hitSlop` rather than shrinking the target.

**Composed list labels.** A row announces as one sentence — "Shell, 12 March, 45.20
litres, $68.40" — instead of four disconnected fragments. This is what makes a list
navigable by ear.

**Live regions for state changes.** Validation errors and snackbars announce. Snackbars
carrying an Undo action use `assertive`, because a polite announcement can arrive after
the action has already timed out.

**Dynamic type throughout**, with per-role caps and recomputed line heights — React
Native does not scale `lineHeight` with `fontSize`, so text overlaps its own line box at
large accessibility sizes unless it is handled explicitly.

---

## Component inventory

| Component                               | Notes                                                                |
| --------------------------------------- | -------------------------------------------------------------------- |
| `Text`                                  | Type role + colour role only; no free `fontSize` or `color`          |
| `Surface` / `Card`                      | Tonal elevation; tappable cards route through `Pressable`            |
| `Button`                                | 6 variants × 4 sizes, up to an 80dp `extraLarge` for primary actions |
| `IconButton`                            | Requires `accessibilityLabel` — icon-only is unusable without it     |
| `FAB` / `FABMenu`                       | Collapses on scroll; speed-dial for the six add actions              |
| `TextField`                             | Floating label, unit suffix, live validation, announced errors       |
| `Chip` / `SegmentedButtons`             | Filter chips swap icon for a check when selected                     |
| `ListItem`                              | One to three lines, composed accessible label                        |
| `StatusPill` / `TrendIndicator`         | Icon + colour + text; direction comes from the domain                |
| `LinearProgress` / `CircularProgress`   | Value printed as well as encoded in the arc                          |
| `Skeleton`                              | Content-shaped, so layout does not jump; static under reduced motion |
| `EmptyState`                            | Requires a description saying what to do next                        |
| `BottomSheet`                           | Gesture on the UI thread; dismiss on velocity _or_ distance          |
| `Dialog`                                | Reserved for irreversible actions; everything else uses Undo         |
| `Snackbar`                              | Undo host; `inversePrimary` for the action on inverse surfaces       |
| `TopAppBar`                             | Large variant collapses on scroll, driven by a shared value          |
| `LineChart` / `BarChart` / `DonutChart` | Spare by default; legend carries the data                            |

---

## States

Every major surface has a designed empty, loading, offline, error and success state.
Two rules:

- An empty state must say **what to do next**. "No records" is a dead end.
- Offline is **informative, not alarming**: "Offline — 3 changes saved here and will
  sync automatically." Being offline is an expected state the user need not act on.
