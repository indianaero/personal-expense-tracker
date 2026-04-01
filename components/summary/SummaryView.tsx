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
  Button,
} from '@heroui/react'
import Link from 'next/link'
import type { Category, MonthlySummary } from '@/types/models'
import { MonthSelector } from './MonthSelector'

interface Props {
  summary: MonthlySummary | null
  categories: Category[]
  year: number
  month: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function SummaryView({ summary, categories, year, month }: Props) {
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const totalSpent = summary?.total_spent ?? 0
  const expenseCount = summary?.expense_count ?? 0
  const avgPerTransaction = expenseCount > 0 ? totalSpent / expenseCount : 0

  const breakdownRows = summary
    ? [...summary.category_breakdown].sort((a, b) => b.total - a.total)
    : []

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Monthly Summary</h1>
          <p className="text-default-400 text-sm">{monthLabel(year, month)}</p>
        </div>
        <MonthSelector year={year} month={month} />
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Total Spent</span>
            <span className="text-2xl font-bold">{formatCurrency(totalSpent)}</span>
            <Chip color="default" variant="flat" size="sm">{monthLabel(year, month)}</Chip>
          </CardBody>
        </Card>

        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Transactions</span>
            <span className="text-2xl font-bold">{expenseCount}</span>
            <Chip color="default" variant="flat" size="sm">this month</Chip>
          </CardBody>
        </Card>

        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Avg per Transaction</span>
            <span className="text-2xl font-bold">
              {expenseCount > 0 ? formatCurrency(avgPerTransaction) : '—'}
            </span>
            <Chip color="default" variant="flat" size="sm">
              {expenseCount > 0 ? `across ${expenseCount} transactions` : 'No transactions'}
            </Chip>
          </CardBody>
        </Card>

      </div>

      {/* ── Category breakdown ──────────────────────────────────────────────── */}
      <Card shadow="sm">
        <CardHeader className="flex items-center justify-between">
          <span className="font-semibold">Spending by Category</span>
          <span className="text-default-400 text-sm">{monthLabel(year, month)}</span>
        </CardHeader>
        <CardBody>
          {breakdownRows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-default-400 text-sm text-center">
                No expenses recorded for {monthLabel(year, month)}.
              </p>
              <Button as={Link} href="/expenses" color="primary" size="sm">
                Add an expense
              </Button>
            </div>
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

    </div>
  )
}
