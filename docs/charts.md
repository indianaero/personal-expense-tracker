# Charts & Visualisation Specification

**Library:** `react-chartjs-2` wrapping `chart.js`
**Rule:** All charts are `'use client'` components. They are always lazy-loaded via `next/dynamic` with `ssr: false`. No chart logic lives in Server Components or pages.

---

## 1. Setup & Registration

Chart.js uses a tree-shakable registration model. Import and register only the primitives each chart type needs. Never call `Chart.register(...)` with the full `auto` import — it bloats the bundle.

Each chart component calls `Chart.register(...)` at the top of the file, outside the component function.

### Required registrations by chart type

| Chart type | Register |
|---|---|
| Bar | `BarElement`, `CategoryScale`, `LinearScale`, `Tooltip`, `Legend` |
| Line | `LineElement`, `PointElement`, `CategoryScale`, `LinearScale`, `Tooltip`, `Legend`, `Filler` |
| Doughnut / Pie | `ArcElement`, `Tooltip`, `Legend` |

```ts
// Example for a bar chart
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)
```

---

## 2. Lazy Loading (Required)

Every chart component **must** be loaded via `next/dynamic` with `ssr: false`. Chart.js accesses browser APIs (`window`, `canvas`, `ResizeObserver`) that are not available during SSR.

```tsx
// In any page or parent component
import dynamic from 'next/dynamic'

const SpendingBarChart = dynamic(
  () => import('@/components/charts/SpendingBarChart').then(m => m.SpendingBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
```

The `loading` prop should pass a `<ChartSkeleton />` component (see Section 7) so the layout does not shift while the chart bundle loads.

---

## 3. Responsiveness

All charts must be fully responsive. Follow these rules without exception.

### 3.1 Container

Wrap every chart in a `relative` container with a defined height. Chart.js `responsive: true` fills the container; without a height constraint the canvas collapses to 0.

```tsx
// ✓ Correct — height controlled by the wrapper
<div className="relative h-64 w-full">
  <Bar data={data} options={options} />
</div>

// ✗ Wrong — canvas height will be 0
<Bar data={data} options={options} />
```

Use Tailwind height classes:

| Context | Recommended class |
|---|---|
| Dashboard stat chart (small) | `h-48` |
| Dashboard main chart | `h-64` |
| Full-width report chart | `h-72 md:h-80` |
| Modal / drawer chart | `h-56` |

### 3.2 Chart.js options (always set)

```ts
const options = {
  responsive: true,
  maintainAspectRatio: false, // REQUIRED — lets the wrapper div control height
  // ...
}
```

`maintainAspectRatio: false` is mandatory on every chart. Without it Chart.js ignores the wrapper height and uses a fixed aspect ratio.

### 3.3 Mobile layout adjustments

For charts rendered inside cards that span the full viewport width on mobile, disable or simplify labels to prevent overlap:

```ts
scales: {
  x: {
    ticks: {
      maxRotation: 0,
      autoSkip: true,
      maxTicksLimit: 6,  // reduce labels on narrow screens
    },
  },
},
```

---

## 4. Theme Integration

Charts must visually match the HeroUI design system in both light and dark mode. Never hardcode hex values. Derive all colours from CSS custom properties at runtime.

### 4.1 Reading CSS variables

Read computed styles inside the component, not at module scope (module scope runs once on import; theme can change at runtime).

```ts
function getCssVar(variable: string): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim()
}
```

### 4.2 HeroUI semantic tokens → Chart colours

Map HeroUI CSS variables to chart roles consistently across the app:

| Role | CSS variable | Usage |
|---|---|---|
| Primary data series | `--heroui-primary` | Main bar/line colour |
| Success / positive | `--heroui-success` | Income, savings, positive deltas |
| Danger / negative | `--heroui-danger` | Overspending, negative deltas |
| Warning | `--heroui-warning` | Near-budget indicators |
| Secondary | `--heroui-secondary` | Second data series |
| Muted text | `--heroui-default-400` | Axis labels, tick text |
| Divider / grid | `--heroui-divider` | Grid lines |
| Background | `--heroui-content1` | Tooltip background |

### 4.3 Applying colours in options

```ts
const primary   = getCssVar('--heroui-primary')
const muted     = getCssVar('--heroui-default-400')
const gridColor = getCssVar('--heroui-divider')

const options: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: muted,
        font: { family: 'var(--font-geist-sans)', size: 12 },
      },
    },
    tooltip: {
      backgroundColor: getCssVar('--heroui-content1'),
      titleColor: getCssVar('--heroui-foreground'),
      bodyColor: muted,
      borderColor: getCssVar('--heroui-divider'),
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { color: gridColor },
      ticks: { color: muted },
    },
    y: {
      grid: { color: gridColor },
      ticks: { color: muted },
    },
  },
}
```

### 4.4 Reacting to theme changes

Re-read CSS variables when the theme changes. The simplest way is to depend on a `theme` value from `useTheme()`:

```tsx
import { useTheme } from 'next-themes'

export function SpendingBarChart({ data }: Props) {
  const { resolvedTheme } = useTheme()

  const chartOptions = useMemo(() => buildOptions(resolvedTheme), [resolvedTheme])

  return (
    <div className="relative h-64 w-full">
      <Bar data={chartData} options={chartOptions} />
    </div>
  )
}
```

`buildOptions` is a pure function at module scope that calls `getCssVar(...)` and returns the options object.

---

## 5. Chart Types & Specifications

### 5.1 Bar Chart — Monthly Spending

**Used on:** Dashboard (6-month trend), Reports (month-over-month)

```tsx
'use client'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)
```

Data shape:
```ts
const data = {
  labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
  datasets: [
    {
      label: 'Spending',
      data: [420, 380, 610, 290, 450, 510],
      backgroundColor: primary + 'CC',  // 80% opacity
      borderColor: primary,
      borderWidth: 1,
      borderRadius: 6,
      borderSkipped: false,
    },
  ],
}
```

Options specifics:
- `plugins.legend.display: false` — the card header already labels the chart
- `scales.y.ticks.callback: (v) => '$' + v` — currency prefix on Y axis
- Highlight current month bar by giving it full opacity, all others 60%

### 5.2 Doughnut Chart — Category Breakdown

**Used on:** Dashboard (spending by category), Reports (category split)

```tsx
'use client'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)
```

Data shape:
```ts
const data = {
  labels: categories.map(c => c.name),
  datasets: [
    {
      data: categories.map(c => c.total),
      backgroundColor: CATEGORY_PALETTE,  // see Section 6
      borderColor: getCssVar('--heroui-content1'),
      borderWidth: 2,
      hoverOffset: 6,
    },
  ],
}
```

Options specifics:
- `cutout: '70%'` — ring style, not filled pie
- `plugins.legend.position: 'bottom'`
- `plugins.legend.labels.boxWidth: 12`, `boxHeight: 12`, `borderRadius: 4`
- Centre label plugin (see Section 5.4) showing total spend

Layout: rendered in a `relative h-56 w-full max-w-xs mx-auto` container inside a `CardBody`.

### 5.3 Line Chart — Spending Over Time

**Used on:** Reports (daily/weekly trend within a period)

```tsx
'use client'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)
```

Data shape:
```ts
const data = {
  labels: dateLabels,
  datasets: [
    {
      label: 'Daily Spending',
      data: dailyTotals,
      borderColor: primary,
      backgroundColor: primary + '1A',  // 10% opacity fill
      fill: true,
      tension: 0.4,          // smooth curve
      pointRadius: 3,
      pointHoverRadius: 5,
    },
  ],
}
```

Options specifics:
- `scales.y.min: 0` — always start from zero to avoid misleading visual scaling
- `plugins.tooltip.mode: 'index'`, `intersect: false` — show tooltip on hover over entire column

### 5.4 Centre Label Plugin (Doughnut only)

Register a custom inline plugin to render total spend in the centre of the doughnut ring. Do **not** use a third-party plugin for this.

```ts
const centreTextPlugin = {
  id: 'centreText',
  beforeDraw(chart: ChartJS) {
    const { ctx, chartArea } = chart
    if (!chartArea) return

    const total = (chart.data.datasets[0].data as number[]).reduce((s, v) => s + v, 0)
    const cx = (chartArea.left + chartArea.right) / 2
    const cy = (chartArea.top + chartArea.bottom) / 2

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = getCssVar('--heroui-foreground')
    ctx.font = `bold 18px var(--font-geist-sans)`
    ctx.fillText(formatCurrency(total), cx, cy - 8)

    ctx.fillStyle = getCssVar('--heroui-default-400')
    ctx.font = `12px var(--font-geist-sans)`
    ctx.fillText('total', cx, cy + 12)
    ctx.restore()
  },
}

// Pass as the plugins array on the Doughnut component
<Doughnut data={data} options={options} plugins={[centreTextPlugin]} />
```

---

## 6. Category Colour Palette

Use a fixed, ordered palette for category colours. This ensures consistent colour assignment as categories are added or removed and works in both light and dark modes.

```ts
// lib/charts/palette.ts
export const CATEGORY_PALETTE = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f43f5e', // rose
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
]
```

Rules:
- Assign colours by stable index (category list sorted alphabetically or by creation order)
- If there are more categories than palette entries, cycle: `CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]`
- Use `backgroundColor` at 80% opacity (`color + 'CC'`) for bars and areas; full opacity for doughnut arcs
- The same category always gets the same colour across all charts on the page

---

## 7. Loading State

Every chart component accepts an `isLoading` prop. When `true`, render a `Skeleton` placeholder that matches the chart container dimensions exactly so the layout does not shift when the chart loads.

```tsx
import { Skeleton } from '@heroui/react'

function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return <Skeleton className={`w-full ${height} rounded-xl`} />
}
```

Usage pattern:
```tsx
{isLoading ? (
  <ChartSkeleton height="h-64" />
) : (
  <div className="relative h-64 w-full">
    <Bar data={chartData} options={chartOptions} />
  </div>
)}
```

Also pass `ChartSkeleton` as the `loading` prop when using `next/dynamic`:
```tsx
const SpendingBarChart = dynamic(
  () => import('@/components/charts/SpendingBarChart').then(m => m.SpendingBarChart),
  { ssr: false, loading: () => <ChartSkeleton height="h-64" /> }
)
```

---

## 8. Empty State

When the dataset is empty (no expenses in the selected period), do not render the chart. Render the standard empty-state pattern from `docs/ui.md` instead.

```tsx
if (data.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <p className="text-default-400 text-sm">No data for this period.</p>
    </div>
  )
}
```

---

## 9. File & Component Conventions

| Convention | Rule |
|---|---|
| Location | `components/charts/` — one file per chart type |
| Naming | `PascalCase` + chart type suffix: `SpendingBarChart.tsx`, `CategoryDoughnutChart.tsx`, `SpendingLineChart.tsx` |
| Export | Named export only — required by `next/dynamic` `.then(m => m.ComponentName)` |
| `'use client'` | Every chart file must have `'use client'` as its first line |
| ChartJS.register | Called once at module scope in each chart file, outside the component |
| Props interface | Always typed; data is passed as plain primitives, not raw Supabase rows |
| Options | Built in a `buildOptions()` function at module scope that takes `resolvedTheme` as a parameter |
| No global registration | Never call `import 'chart.js/auto'` — always register explicitly |

### Canonical file structure

```
components/
  charts/
    SpendingBarChart.tsx       — 6-month bar chart
    CategoryDoughnutChart.tsx  — category breakdown ring
    SpendingLineChart.tsx      — daily/weekly line chart
    ChartSkeleton.tsx          — shared skeleton placeholder
lib/
  charts/
    palette.ts                 — CATEGORY_PALETTE constant
    formatters.ts              — shared axis/tooltip formatters (e.g. currency tick callback)
```

---

## 10. Performance Rules

These rules apply in addition to `docs/best-practices.md`.

| Rule | Reason |
|---|---|
| Always use `next/dynamic` with `ssr: false` | Chart.js uses `window` and `canvas` — SSR will throw |
| Register only what you use | Full `chart.js/auto` import adds ~200 KB to the bundle |
| Memoize `data` and `options` objects with `useMemo` | Chart.js diffs by reference — new objects on every render cause unnecessary redraws |
| Pass `resolvedTheme` as a `useMemo` dependency | Regenerates options only when the theme actually changes |
| Preload on sidebar hover | Add `onMouseEnter` preload to the Reports sidebar link (see `docs/best-practices.md` §2.4) |
| Avoid inline `plugins` arrays | Defining `plugins={[myPlugin]}` inline creates a new array every render — define at module scope |

```tsx
// ✓ Memoize data and options
const chartData = useMemo(() => buildChartData(expenses), [expenses])
const chartOptions = useMemo(() => buildOptions(resolvedTheme), [resolvedTheme])

// ✓ Module-scope plugin array
const PLUGINS = [centreTextPlugin]

return <Doughnut data={chartData} options={chartOptions} plugins={PLUGINS} />
```

---

## 11. Accessibility

| Requirement | Implementation |
|---|---|
| Canvas `role` | Chart.js sets `role="img"` automatically on the `<canvas>` |
| Accessible description | Pass `aria-label` to the chart component: `<Bar aria-label="Monthly spending for the last 6 months" .../>` |
| Colour-blind safe | The `CATEGORY_PALETTE` is designed to be distinguishable at 8% deuteranopia simulation. Do not rely on colour alone — tooltips and legends always show text labels |
| Keyboard | Charts are not interactive keyboard targets (read-only visualisations). The underlying data is always available in a `Table` on the same page |
| `prefers-reduced-motion` | Disable animation for users who opt out: `animation: { duration: prefersReducedMotion ? 0 : 400 }` |

```ts
const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

const options = {
  animation: { duration: prefersReducedMotion ? 0 : 400 },
  // ...
}
```
