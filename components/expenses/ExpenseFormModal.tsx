'use client'
import { useActionState, useState, useEffect } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  NumberInput,
  Select,
  SelectItem,
  Switch,
  Textarea,
  Alert,
  DatePicker,
  addToast,
} from '@heroui/react'
import { parseDate } from '@internationalized/date'
import type { DateValue } from '@heroui/react'
import { createExpenseAction, updateExpenseAction } from '@/lib/actions/expense'
import { CreateExpenseSchema, UpdateExpenseSchema } from '@/lib/schemas/expense'
import type { Expense, Category } from '@/types/models'

interface Props {
  expense?: Expense
  categories: Category[]
  onClose: () => void
}

const initialState = { status: 'idle' } as const

export function ExpenseFormModal({ expense, categories, onClose }: Props) {
  const isEdit = !!expense

  // Two action states — always called (hooks must not be conditional)
  const [createState, createDispatch, isCreating] = useActionState(
    createExpenseAction,
    initialState,
  )
  const [updateState, updateDispatch, isUpdating] = useActionState(
    updateExpenseAction,
    initialState,
  )

  const state = isEdit ? updateState : createState
  const isPending = isEdit ? isUpdating : isCreating

  // Controlled field state
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState<number>(expense?.amount ?? 0)
  const [categoryId, setCategoryId] = useState<string>(expense?.category_id ?? '')
  const [date, setDate] = useState<DateValue | null>(
    expense?.date ? parseDate(expense.date) : null,
  )
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [isRecurring, setIsRecurring] = useState(expense?.is_recurring ?? false)

  // Client-side field errors (pre-dispatch)
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})

  // Close modal and show toast on success
  useEffect(() => {
    if (state.status === 'success') {
      addToast({
        title: isEdit ? 'Expense updated' : 'Expense saved',
        color: 'success',
        timeout: 3000,
      })
      onClose()
    }
  }, [state.status]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setClientErrors({})

    const raw = {
      description,
      amount,
      category_id: categoryId,
      date: date ? date.toString() : '',
      notes: notes.trim() || null,
      is_recurring: isRecurring,
    }

    const schema = isEdit ? UpdateExpenseSchema : CreateExpenseSchema
    const result = schema.safeParse(raw)

    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.')
        if (!errors[key]) errors[key] = issue.message
      }
      setClientErrors(errors)
      return
    }

    if (isEdit) {
      updateDispatch({ id: expense.id, ...result.data })
    } else {
      createDispatch(result.data as Parameters<typeof createDispatch>[0])
    }
  }

  // Server field errors take precedence over client errors
  const fieldErrors =
    state.status === 'error' && state.fields
      ? Object.fromEntries(Object.entries(state.fields).map(([k, v]) => [k, v[0]]))
      : clientErrors

  const formError =
    state.status === 'error' && !state.fields ? state.error : null

  return (
    <Modal
      isOpen
      size="md"
      scrollBehavior="inside"
      isDismissable={!isPending}
      onClose={onClose}
    >
      <ModalContent>
        <form onSubmit={handleSubmit} noValidate>
          <ModalHeader>{isEdit ? 'Edit Expense' : 'Add Expense'}</ModalHeader>

          <ModalBody className="flex flex-col gap-4">
            {formError && (
              <Alert color="danger" variant="flat" title={formError} />
            )}

            <Input
              label="Description"
              variant="bordered"
              labelPlacement="outside"
              placeholder="e.g. Grocery run"
              isRequired
              value={description}
              onValueChange={setDescription}
              isInvalid={!!fieldErrors.description}
              errorMessage={fieldErrors.description}
            />

            <NumberInput
              label="Amount"
              variant="bordered"
              labelPlacement="outside"
              startContent={<span className="text-default-400 text-sm">$</span>}
              isRequired
              minValue={0.01}
              value={amount}
              onValueChange={(val) => setAmount(typeof val === 'number' ? val : 0)}
              isInvalid={!!fieldErrors.amount}
              errorMessage={fieldErrors.amount}
            />

            <Select
              label="Category"
              variant="bordered"
              labelPlacement="outside"
              placeholder="Select a category"
              isRequired
              selectedKeys={categoryId ? new Set([categoryId]) : new Set()}
              onSelectionChange={(keys) => {
                const key = Array.from(keys)[0] as string
                setCategoryId(key ?? '')
              }}
              isInvalid={!!fieldErrors.category_id}
              errorMessage={fieldErrors.category_id}
            >
              {categories.map((c) => (
                <SelectItem key={c.id}>{c.name}</SelectItem>
              ))}
            </Select>

            <DatePicker
              label="Date"
              variant="bordered"
              labelPlacement="outside"
              granularity="day"
              isRequired
              value={date}
              onChange={setDate}
              isInvalid={!!fieldErrors.date}
              errorMessage={fieldErrors.date}
            />

            <Textarea
              label="Notes"
              variant="bordered"
              labelPlacement="outside"
              placeholder="Optional notes"
              maxRows={3}
              value={notes}
              onValueChange={setNotes}
              isInvalid={!!fieldErrors.notes}
              errorMessage={fieldErrors.notes}
            />

            <Switch isSelected={isRecurring} onValueChange={setIsRecurring}>
              Recurring expense
            </Switch>
          </ModalBody>

          <ModalFooter>
            <Button variant="light" onPress={onClose} isDisabled={isPending}>
              Cancel
            </Button>
            <Button color="primary" type="submit" isLoading={isPending}>
              Save
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
