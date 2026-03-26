'use client'
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Avatar,
  Listbox,
  ListboxItem,
  Button,
  Divider,
} from '@heroui/react'
import Link from 'next/link'
import type { Category, Expense, MonthlySummary } from '@/types/models'

interface Props {
  summary: MonthlySummary | null
  categories: Category[]
  allExpenses: Expense[]
  year: number
  month: number
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function monthLabel(year: number, month: number, short = false): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: short ? 'short' : 'long',
    year: 'numeric',
  })
}

// ── Monthly trend helpers ─────────────────────────────────────────────────────

interface TrendRow {
  year: number
  month: number
  label: string
  total: number
  count: number
  delta: number | null // vs prior month; null for the oldest row
}

function computeTrend(expenses: Expense[], currentYear: number, currentMonth: number): TrendRow[] {
  // Build oldest→newest array of the last 6 months
  const months: { year: number; month: number }[] = []
  for (let i = 5; i >= 0; i--) {
    let m = currentMonth - i
    let y = currentYear
    while (m <= 0) { m += 12; y-- }
    months.push({ year: y, month: m })
  }

  const rows = months.map(({ year, month }) => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    const slice = expenses.filter((e) => e.date.startsWith(prefix))
    return {
      year,
      month,
      label: monthLabel(year, month, true),
      total: slice.reduce((s, e) => s + Number(e.amount), 0),
      count: slice.length,
      delta: null as number | null,
    }
  })

  // Compute delta vs prior row
  for (let i = 1; i < rows.length; i++) {
    rows[i].delta = rows[i].total - rows[i - 1].total
  }

  // Return most-recent first
  return rows.reverse()
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-default-300">—</span>
  if (delta === 0) return <Chip size="sm" variant="flat" color="default">No change</Chip>
  const isUp = delta > 0
  return (
    <Chip size="sm" variant="flat" color={isUp ? 'danger' : 'success'}>
      {isUp ? '↑' : '↓'} {formatCurrency(Math.abs(delta))}
    </Chip>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardView({ summary, categories, allExpenses, year, month }: Props) {
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // Stat card values
  const totalSpent = summary?.total_spent ?? 0
  const expenseCount = summary?.expense_count ?? 0
  const avgPerTransaction = expenseCount > 0 ? totalSpent / expenseCount : 0

  const breakdownRows = summary
    ? [...summary.category_breakdown].sort((a, b) => b.total - a.total)
    : []

  const largestCategory = breakdownRows.length > 0
    ? { name: categoryMap.get(breakdownRows[0].category_id)?.name ?? '—', total: breakdownRows[0].total }
    : null

  // 6-month trend
  const trend = computeTrend(allExpenses, year, month)

  // Recent expenses — last 8 across all time
  const recentExpenses = allExpenses.slice(0, 8)

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* ── Zone 1: Stat cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Total Spent</span>
            <span className="text-2xl font-bold">{formatCurrency(totalSpent)}</span>
            <Chip color="default" variant="flat" size="sm">{monthLabel(year, month)}</Chip>
          </CardBody>
        </Card>

        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Avg per Transaction</span>
            <span className="text-2xl font-bold">
              {expenseCount > 0 ? formatCurrency(avgPerTransaction) : '—'}
            </span>
            <Chip color="default" variant="flat" size="sm">
              {expenseCount > 0 ? `${expenseCount} transactions` : 'No transactions'}
            </Chip>
          </CardBody>
        </Card>

        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Top Category</span>
            <span className="text-2xl font-bold truncate">
              {largestCategory ? largestCategory.name : '—'}
            </span>
            {largestCategory && (
              <Chip color="primary" variant="flat" size="sm">
                {formatCurrency(largestCategory.total)}
              </Chip>
            )}
          </CardBody>
        </Card>

        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Transactions</span>
            <span className="text-2xl font-bold">{expenseCount}</span>
            <Chip color="default" variant="flat" size="sm">this month</Chip>
          </CardBody>
        </Card>

      </div>

      {/* ── Zone 2: 6-month trend ─────────────────────────────────────────── */}
      <Card shadow="sm">
        <CardHeader className="flex items-center justify-between">
          <span className="font-semibold">6-Month Spending Trend</span>
        </CardHeader>
        <CardBody>
          <Table removeWrapper selectionMode="none" aria-label="Monthly spending trend">
            <TableHeader>
              <TableColumn key="month">Month</TableColumn>
              <TableColumn key="total" align="end">Total Spent</TableColumn>
              <TableColumn key="count" align="end">Transactions</TableColumn>
              <TableColumn key="delta" align="end">vs Prior Month</TableColumn>
            </TableHeader>
            <TableBody items={trend}>
              {(row) => (
                <TableRow key={`${row.year}-${row.month}`}>
                  <TableCell>
                    <span className={row.year === year && row.month === month ? 'font-semibold text-primary' : ''}>
                      {row.label}
                      {row.year === year && row.month === month && (
                        <Chip size="sm" variant="flat" color="primary" className="ml-2">Current</Chip>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {row.total > 0 ? formatCurrency(row.total) : <span className="text-default-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.count > 0 ? row.count : <span className="text-default-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeltaChip delta={row.delta} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* ── Zone 3: Category breakdown (current month) ───────────────────── */}
      <Card shadow="sm">
        <CardHeader className="flex items-center justify-between">
          <span className="font-semibold">Spending by Category</span>
          <span className="text-default-400 text-sm">{monthLabel(year, month)}</span>
        </CardHeader>
        <CardBody>
          {breakdownRows.length === 0 ? (
            <p className="text-default-400 text-sm py-4 text-center">No expenses this month.</p>
          ) : (
            <Table removeWrapper selectionMode="none" aria-label="Category spending breakdown">
              <TableHeader>
                <TableColumn key="category">Category</TableColumn>
                <TableColumn key="amount" align="end">Amount</TableColumn>
                <TableColumn key="percent" align="end">% of Total</TableColumn>
                <TableColumn key="count" align="end">Transactions</TableColumn>
              </TableHeader>
              <TableBody items={breakdownRows}>
                {(row) => (
                  <TableRow key={row.category_id}>
                    <TableCell>
                      <Chip variant="flat" size="sm">
                        {categoryMap.get(row.category_id)?.name ?? '—'}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {totalSpent > 0
                        ? `${((row.total / totalSpent) * 100).toFixed(1)}%`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* ── Zone 4: Recent expenses ───────────────────────────────────────── */}
      <Card shadow="sm">
        <CardHeader className="flex items-center justify-between">
          <span className="font-semibold">Recent Expenses</span>
          <Button as={Link} href="/expenses" variant="light" size="sm">
            View all
          </Button>
        </CardHeader>
        <CardBody className="px-0">
          {recentExpenses.length === 0 ? (
            <p className="text-default-400 text-sm py-4 text-center px-4">
              No expenses yet.{' '}
              <Link href="/expenses" className="text-primary underline">
                Add your first
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-col">
              {recentExpenses.map((expense, idx) => {
                const category = categoryMap.get(expense.category_id)
                return (
                  <div key={expense.id}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Avatar
                        name={category?.name?.[0]?.toUpperCase() ?? '?'}
                        size="sm"
                        radius="sm"
                        color="primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{expense.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-default-400 text-xs">{formatDate(expense.date)}</span>
                          {category && (
                            <Chip size="sm" variant="flat" className="text-xs h-5">
                              {category.name}
                            </Chip>
                          )}
                          {expense.is_recurring && (
                            <Chip size="sm" variant="dot" color="secondary" className="text-xs h-5">
                              Recurring
                            </Chip>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-sm shrink-0">
                        {formatCurrency(expense.amount)}
                      </span>
                    </div>
                    {idx < recentExpenses.length - 1 && <Divider />}
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>

    </div>
  )
}
