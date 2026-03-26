'use client'
import { useState, useOptimistic, useTransition } from 'react'
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  addToast,
} from '@heroui/react'
import { deleteExpenseAction } from '@/lib/actions/expense'
import { ExpenseFormModal } from './ExpenseFormModal'
import { DeleteExpenseModal } from './DeleteExpenseModal'
import type { Expense, Category } from '@/types/models'

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; expense: Expense }
  | { type: 'delete'; expense: Expense }

interface Props {
  expenses: Expense[]
  categories: Category[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function ExpensesView({ expenses: initialExpenses, categories }: Props) {
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [isPending, startTransition] = useTransition()

  const [expenses, optimisticDelete] = useOptimistic(
    initialExpenses,
    (current: Expense[], deletedId: string) =>
      current.filter((e) => e.id !== deletedId),
  )

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  function handleDeleteConfirm(expense: Expense) {
    startTransition(async () => {
      optimisticDelete(expense.id)
      setModal({ type: 'none' })
      const result = await deleteExpenseAction({ id: expense.id })
      if (result.status === 'error') {
        addToast({ title: result.error, color: 'danger', timeout: 6000 })
      } else {
        addToast({ title: 'Expense deleted', color: 'danger', timeout: 3000 })
      }
    })
  }

  const toolbar = (
    <div className="flex items-center justify-between">
      <span className="text-default-400 text-sm">
        {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
      </span>
      <Button
        color="primary"
        size="sm"
        onPress={() => setModal({ type: 'create' })}
      >
        Add Expense
      </Button>
    </div>
  )

  return (
    <>
      <div className="flex flex-col gap-4 p-6">
        {expenses.length === 0 ? (
          <>
            {toolbar}
            <Card>
              <CardBody className="flex flex-col items-center gap-3 py-12">
                <p className="text-xl font-semibold">No expenses yet</p>
                <p className="text-default-400 text-sm">
                  Add your first expense to get started.
                </p>
                <Button
                  color="primary"
                  size="sm"
                  onPress={() => setModal({ type: 'create' })}
                >
                  Add your first expense
                </Button>
              </CardBody>
            </Card>
          </>
        ) : (
          <Table
            aria-label="Expenses"
            isStriped
            topContent={toolbar}
            topContentPlacement="outside"
          >
            <TableHeader>
              <TableColumn key="date">Date</TableColumn>
              <TableColumn key="description">Description</TableColumn>
              <TableColumn key="category">Category</TableColumn>
              <TableColumn key="amount" align="end">Amount</TableColumn>
              <TableColumn key="recurring" width={110}>{' '}</TableColumn>
              <TableColumn key="actions" width={60}>{' '}</TableColumn>
            </TableHeader>

            <TableBody items={expenses}>
              {(expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{formatDate(expense.date)}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>
                    <Chip variant="flat" size="sm">
                      {categoryMap.get(expense.category_id)?.name ?? '—'}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatAmount(expense.amount)}
                  </TableCell>
                  <TableCell>
                    {expense.is_recurring && (
                      <Chip color="secondary" variant="dot" size="sm">
                        Recurring
                      </Chip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          aria-label="Expense actions"
                        >
                          ···
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Expense actions">
                        <DropdownItem
                          key="edit"
                          onPress={() => setModal({ type: 'edit', expense })}
                        >
                          Edit
                        </DropdownItem>
                        <DropdownItem
                          key="delete"
                          color="danger"
                          className="text-danger"
                          onPress={() => setModal({ type: 'delete', expense })}
                        >
                          Delete
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {modal.type === 'create' && (
        <ExpenseFormModal
          categories={categories}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'edit' && (
        <ExpenseFormModal
          expense={modal.expense}
          categories={categories}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'delete' && (
        <DeleteExpenseModal
          expense={modal.expense}
          onConfirm={() => handleDeleteConfirm(modal.expense as Expense)}
          onClose={() => setModal({ type: 'none' })}
          isPending={isPending}
        />
      )}
    </>
  )
}
