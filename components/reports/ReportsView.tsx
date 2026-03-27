'use client'
import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardHeader,
  Chip,
} from '@heroui/react'
import type { Category, Expense } from '@/types/models'
import { ChartSkeleton } from '@/components/charts/ChartSkeleton'
import { formatCurrency } from '@/lib/charts/formatters'
import { paletteColor } from '@/lib/charts/palette'

// ── Lazy-loaded charts ─────────────────────────────────────────────────────

const SpendingBarChart = dynamic(
  () => import('@/components/charts/SpendingBarChart').then((m) => m.SpendingBarChart),
  { ssr: false, loading: () => <ChartSkeleton height="h-64" /> },
)

const CategoryDoughnutChart = dynamic(
  () => import('@/components/charts/CategoryDoughnutChart').then((m) => m.CategoryDoughnutChart),
  { ssr: false, loading: () => <ChartSkeleton height="h-72" /> },
)

// ── Types ──────────────────────────────────────────────────────────────────

type Period = 3 | 6 | 12

interface Props {
  expenses: Expense[]
  categories: Category[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

function monthsBack(n: Period): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    let m = now.getMonth() + 1 - i
    let y = now.getFullYear()
    while (m <= 0) { m += 12; y-- }
    result.push({ year: y, month: m })
  }
  return result
}

function shortMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  })
}

// ── Main component ─────────────────────────────────────────────────────────

export function ReportsView({ expenses, categories }: Props) {
  const [period, setPeriod] = useState<Period>(6)

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  // Month bars for the bar chart
  const monthBars = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    return monthsBack(period).map(({ year, month }) => {
      const prefix = `${year}-${String(month).padStart(2, '0')}`
      const total = expenses
        .filter((e) => e.date.startsWith(prefix))
        .reduce((s, e) => s + Number(e.amount), 0)
      return {
        label: shortMonthLabel(year, month),
        total,
        isCurrent: year === currentYear && month === currentMonth,
      }
    })
  }, [expenses, period])

  // Category slices for the doughnut — scoped to the selected period
  const categorySlices = useMemo(() => {
    const months = monthsBack(period)
    const prefixes = new Set(
      months.map(({ year, month }) => `${year}-${String(month).padStart(2, '0')}`),
    )

    const totals = new Map<string, number>()
    for (const e of expenses) {
      const prefix = e.date.slice(0, 7)
      if (!prefixes.has(prefix)) continue
      totals.set(e.category_id, (totals.get(e.category_id) ?? 0) + Number(e.amount))
    }

    return [...totals.entries()]
      .map(([id, total]) => ({
        name: categoryMap.get(id)?.name ?? 'Unknown',
        total,
      }))
      .sort((a, b) => b.total - a.total)
  }, [expenses, categories, period, categoryMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Summary stats for the selected period
  const stats = useMemo(() => {
    const months = monthsBack(period)
    const prefixes = new Set(
      months.map(({ year, month }) => `${year}-${String(month).padStart(2, '0')}`),
    )

    const periodExpenses = expenses.filter((e) => prefixes.has(e.date.slice(0, 7)))

    const totalSpend = periodExpenses.reduce((s, e) => s + Number(e.amount), 0)
    const avgMonthly = months.length > 0 ? totalSpend / months.length : 0

    const highest = periodExpenses.reduce<Expense | null>(
      (max, e) => (max === null || Number(e.amount) > Number(max.amount) ? e : max),
      null,
    )

    const catCounts = new Map<string, number>()
    for (const e of periodExpenses) {
      catCounts.set(e.category_id, (catCounts.get(e.category_id) ?? 0) + 1)
    }
    let topCatId = ''
    let topCatCount = 0
    for (const [id, count] of catCounts) {
      if (count > topCatCount) { topCatId = id; topCatCount = count }
    }
    const topCatName = topCatId ? (categoryMap.get(topCatId)?.name ?? '—') : '—'

    return { avgMonthly, highest, topCatName, totalSpend, hasData: periodExpenses.length > 0 }
  }, [expenses, period, categoryMap])

  const periodLabel = period === 3 ? 'last 3 months' : period === 6 ? 'last 6 months' : 'last 12 months'

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* ── Period selector ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Reports</h1>
        <ButtonGroup size="sm">
          {([3, 6, 12] as Period[]).map((p) => (
            <Button
              key={p}
              color={period === p ? 'primary' : 'default'}
              variant={period === p ? 'solid' : 'bordered'}
              onPress={() => setPeriod(p)}
            >
              {p}M
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {/* ── Summary stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Avg Monthly Spend</span>
            <span className="text-2xl font-bold">
              {stats.hasData ? formatCurrency(stats.avgMonthly) : '—'}
            </span>
            <Chip color="default" variant="flat" size="sm">{periodLabel}</Chip>
          </CardBody>
        </Card>

        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Highest Expense</span>
            <span className="text-2xl font-bold truncate">
              {stats.highest ? formatCurrency(Number(stats.highest.amount)) : '—'}
            </span>
            {stats.highest && (
              <Chip color="default" variant="flat" size="sm" className="truncate max-w-full">
                {stats.highest.description}
              </Chip>
            )}
          </CardBody>
        </Card>

        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Most Used Category</span>
            <span className="text-2xl font-bold truncate">
              {stats.topCatName}
            </span>
            <Chip color="default" variant="flat" size="sm">{periodLabel}</Chip>
          </CardBody>
        </Card>
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      {!stats.hasData ? (
        <Card shadow="sm">
          <CardBody>
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-default-500 font-medium">No expenses in this period</p>
              <p className="text-default-400 text-sm">Add expenses to see your spending charts.</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

          {/* Bar chart */}
          <Card shadow="sm">
            <CardHeader className="flex items-center justify-between">
              <span className="font-semibold">Monthly Spending</span>
              <span className="text-default-400 text-sm">{periodLabel}</span>
            </CardHeader>
            <CardBody>
              <SpendingBarChart months={monthBars} />
            </CardBody>
          </Card>

          {/* Doughnut chart */}
          <Card shadow="sm">
            <CardHeader className="flex items-center justify-between">
              <span className="font-semibold">Spending by Category</span>
              <span className="text-default-400 text-sm">{periodLabel}</span>
            </CardHeader>
            <CardBody>
              {categorySlices.length === 0 ? (
                <div className="flex items-center justify-center h-72">
                  <p className="text-default-400 text-sm">No category data.</p>
                </div>
              ) : (
                <CategoryDoughnutChart slices={categorySlices} />
              )}
            </CardBody>
          </Card>

        </div>
      )}

      {/* ── Category legend with colour swatches ───────────────────────── */}
      {stats.hasData && categorySlices.length > 0 && (
        <Card shadow="sm">
          <CardHeader>
            <span className="font-semibold">Category Breakdown</span>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col gap-2">
              {categorySlices.map((slice, i) => (
                <div key={slice.name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: paletteColor(i) }}
                    />
                    <span className="text-sm truncate">{slice.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-default-400">
                      {stats.totalSpend > 0
                        ? `${((slice.total / stats.totalSpend) * 100).toFixed(1)}%`
                        : '—'}
                    </span>
                    <span className="text-sm font-medium">{formatCurrency(slice.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

    </div>
  )
}
