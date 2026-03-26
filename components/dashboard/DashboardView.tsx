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
} from '@heroui/react'
import Link from 'next/link'
import type { CategoryBreakdown, Category, Expense, MonthlySummary } from '@/types/models'

interface Props {
  summary: MonthlySummary | null
  categories: Category[]
  recentExpenses: Expense[]
  year: number
  month: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function getLargestCategory(
  breakdown: CategoryBreakdown[],
  categoryMap: Map<string, Category>,
): { name: string; total: number } | null {
  if (breakdown.length === 0) return null
  const top = breakdown.reduce((a, b) => (a.total >= b.total ? a : b))
  return { name: categoryMap.get(top.category_id)?.name ?? 'Unknown', total: top.total }
}

export function DashboardView({ summary, categories, recentExpenses, year, month }: Props) {
  const categoryMap = new Map(categories.map((c) => [c.id, c]))
  const largestCategory = summary
    ? getLargestCategory(summary.category_breakdown, categoryMap)
    : null
  const breakdownRows = summary
    ? [...summary.category_breakdown].sort((a, b) => b.total - a.total)
    : []

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Zone 1 — Summary stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Total Spent</span>
            <span className="text-2xl font-bold">
              {summary ? formatCurrency(summary.total_spent) : '$0.00'}
            </span>
            <Chip color="default" variant="flat" size="sm">
              {monthLabel(year, month)}
            </Chip>
          </CardBody>
        </Card>

        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Remaining Budget</span>
            <span className="text-2xl font-bold">—</span>
            <Chip color="default" variant="flat" size="sm">
              No budget set
            </Chip>
          </CardBody>
        </Card>

        <Card shadow="sm" radius="lg">
          <CardBody className="flex flex-col gap-1">
            <span className="text-default-400 text-sm">Largest Category</span>
            <span className="text-2xl font-bold">
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
            <span className="text-default-400 text-sm">Expense Count</span>
            <span className="text-2xl font-bold">
              {summary ? summary.expense_count : 0}
            </span>
            <Chip color="default" variant="flat" size="sm">
              transactions
            </Chip>
          </CardBody>
        </Card>
      </div>

      {/* Zone 2 — Monthly spending breakdown */}
      <Card shadow="sm">
        <CardHeader>
          <span className="font-semibold">Spending by Category</span>
        </CardHeader>
        <CardBody>
          {breakdownRows.length === 0 ? (
            <p className="text-default-400 text-sm py-4 text-center">
              No expenses this month.
            </p>
          ) : (
            <Table
              removeWrapper
              selectionMode="none"
              aria-label="Category spending breakdown"
            >
              <TableHeader>
                <TableColumn key="category">Category</TableColumn>
                <TableColumn key="amount" align="end">Amount</TableColumn>
                <TableColumn key="percent" align="end">% of Total</TableColumn>
                <TableColumn key="transactions" align="end">Transactions</TableColumn>
              </TableHeader>
              <TableBody items={breakdownRows}>
                {(row) => (
                  <TableRow key={row.category_id}>
                    <TableCell>
                      <Chip variant="flat" size="sm">
                        {categoryMap.get(row.category_id)?.name ?? '—'}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {summary
                        ? `${((row.total / summary.total_spent) * 100).toFixed(1)}%`
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

      {/* Zone 3 — Recent expenses */}
      <Card shadow="sm">
        <CardHeader className="flex items-center justify-between">
          <span className="font-semibold">Recent Expenses</span>
          <Button as={Link} href="/expenses" variant="light" size="sm">
            View all
          </Button>
        </CardHeader>
        <CardBody>
          {recentExpenses.length === 0 ? (
            <p className="text-default-400 text-sm py-4 text-center">
              No expenses yet.{' '}
              <Link href="/expenses" className="text-primary underline">
                Add your first
              </Link>
              .
            </p>
          ) : (
            <Listbox aria-label="Recent expenses" items={recentExpenses}>
              {(expense: Expense) => (
                <ListboxItem
                  key={expense.id}
                  textValue={expense.description}
                  startContent={
                    <Avatar
                      name={categoryMap.get(expense.category_id)?.name?.[0] ?? '?'}
                      size="sm"
                      radius="sm"
                    />
                  }
                  endContent={
                    <Chip variant="flat" color="default" size="sm">
                      {formatCurrency(expense.amount)}
                    </Chip>
                  }
                  description={formatDate(expense.date)}
                >
                  {expense.description}
                </ListboxItem>
              )}
            </Listbox>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
