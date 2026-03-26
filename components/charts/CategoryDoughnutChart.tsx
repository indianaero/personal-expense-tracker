'use client'
import { useEffect, useMemo, useState } from 'react'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData,
  type Plugin,
} from 'chart.js'
import { paletteColor } from '@/lib/charts/palette'
import { formatCurrency } from '@/lib/charts/formatters'

ChartJS.register(ArcElement, Tooltip, Legend)

function getCssVar(variable: string): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
}

function useResolvedTheme(): string {
  const [theme, setTheme] = useState('light')
  useEffect(() => {
    const el = document.documentElement
    const read = () => setTheme(el.getAttribute('data-theme') ?? el.className ?? 'light')
    read()
    const observer = new MutationObserver(read)
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

interface CategorySlice {
  name: string
  total: number
}

interface Props {
  slices: CategorySlice[]
}

const centreTextPlugin: Plugin<'doughnut'> = {
  id: 'centreText',
  beforeDraw(chart) {
    const { ctx, chartArea } = chart
    if (!chartArea) return

    const total = (chart.data.datasets[0].data as number[]).reduce((s, v) => s + (v as number), 0)
    const cx = (chartArea.left + chartArea.right) / 2
    const cy = (chartArea.top + chartArea.bottom) / 2

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = getCssVar('--heroui-foreground') || '#000'
    ctx.font = `bold 16px var(--font-geist-sans, sans-serif)`
    ctx.fillText(formatCurrency(total), cx, cy - 8)

    ctx.fillStyle = getCssVar('--heroui-default-400') || '#888'
    ctx.font = `11px var(--font-geist-sans, sans-serif)`
    ctx.fillText('total', cx, cy + 12)
    ctx.restore()
  },
}

const PLUGINS: Plugin<'doughnut'>[] = [centreTextPlugin]

function buildOptions(resolvedTheme: string | undefined): ChartOptions<'doughnut'> {
  void resolvedTheme
  const muted    = getCssVar('--heroui-default-400')
  const content1 = getCssVar('--heroui-content1')
  const fg       = getCssVar('--heroui-foreground')
  const divider  = getCssVar('--heroui-divider')

  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: prefersReducedMotion ? 0 : 400 },
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: muted || '#666',
          font: { family: 'var(--font-geist-sans)', size: 12 },
          boxWidth: 12,
          boxHeight: 12,
          borderRadius: 4,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: content1 || '#fff',
        titleColor: fg || '#000',
        bodyColor: muted || '#666',
        borderColor: divider || '#e5e7eb',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => ' ' + formatCurrency(ctx.parsed as number),
        },
      },
    },
  }
}

export function CategoryDoughnutChart({ slices }: Props) {
  const resolvedTheme = useResolvedTheme()

  const chartData = useMemo((): ChartData<'doughnut'> => {
    const content1 = getCssVar('--heroui-content1')
    return {
      labels: slices.map((s) => s.name),
      datasets: [
        {
          data: slices.map((s) => s.total),
          backgroundColor: slices.map((_, i) => paletteColor(i)),
          borderColor: content1 || '#fff',
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    }
  }, [slices, resolvedTheme]) // eslint-disable-line react-hooks/exhaustive-deps

  const chartOptions = useMemo(() => buildOptions(resolvedTheme), [resolvedTheme])

  return (
    <div className="relative h-72 w-full">
      <Doughnut
        data={chartData}
        options={chartOptions}
        plugins={PLUGINS}
        aria-label="Spending by category doughnut chart"
      />
    </div>
  )
}
