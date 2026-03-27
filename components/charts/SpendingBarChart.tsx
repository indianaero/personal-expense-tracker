'use client'
import { useEffect, useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData,
} from 'chart.js'
import { currencyTickFormatter, formatCurrency } from '@/lib/charts/formatters'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

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

interface MonthBar {
  label: string
  total: number
  isCurrent: boolean
}

interface Props {
  months: MonthBar[]
}

const PLUGINS = [Legend]

function buildOptions(resolvedTheme: string | undefined): ChartOptions<'bar'> {
  void resolvedTheme // consumed only to trigger memo invalidation on theme switch
  const muted     = getCssVar('--heroui-default-400')
  const gridColor = getCssVar('--heroui-divider')
  const content1  = getCssVar('--heroui-content1')
  const fg        = getCssVar('--heroui-foreground')

  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: prefersReducedMotion ? 0 : 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: content1 || '#fff',
        titleColor: fg || '#000',
        bodyColor: muted || '#666',
        borderColor: gridColor || '#e5e7eb',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => ' ' + formatCurrency(ctx.parsed.y ?? 0),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: muted || '#666',
          font: { family: 'var(--font-geist-sans)', size: 12 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
        border: { display: false },
      },
      y: {
        grid: { color: gridColor || '#e5e7eb' },
        ticks: {
          color: muted || '#666',
          font: { family: 'var(--font-geist-sans)', size: 12 },
          callback: (v) => currencyTickFormatter(v as number),
        },
        border: { display: false },
        beginAtZero: true,
      },
    },
  }
}

export function SpendingBarChart({ months }: Props) {
  const resolvedTheme = useResolvedTheme()

  const chartData = useMemo((): ChartData<'bar'> => {
    const primary = getCssVar('--heroui-primary')
    return {
      labels: months.map((m) => m.label),
      datasets: [
        {
          label: 'Spending',
          data: months.map((m) => m.total),
          backgroundColor: months.map((m) =>
            m.isCurrent ? (primary || '#6366f1') : (primary || '#6366f1') + '99',
          ),
          borderColor: months.map((m) =>
            m.isCurrent ? (primary || '#6366f1') : (primary || '#6366f1') + 'CC',
          ),
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    }
  }, [months, resolvedTheme]) // eslint-disable-line react-hooks/exhaustive-deps

  const chartOptions = useMemo(() => buildOptions(resolvedTheme), [resolvedTheme])

  return (
    <div className="relative h-64 w-full">
      <Bar
        data={chartData}
        options={chartOptions}
        plugins={PLUGINS}
        aria-label="Monthly spending bar chart"
      />
    </div>
  )
}
