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
  Switch,
  Alert,
  addToast,
} from '@heroui/react'
import { createCategoryAction, updateCategoryAction } from '@/lib/actions/category'
import { CreateCategorySchema, UpdateCategorySchema } from '@/lib/schemas/category'
import type { Category } from '@/types/models'

interface Props {
  category?: Category
  onClose: () => void
  onArchive?: () => void
  isArchivePending?: boolean
}

const initialState = { status: 'idle' } as const

export function CategoryFormModal({ category, onClose, onArchive, isArchivePending }: Props) {
  const isEdit = !!category

  const [createState, createDispatch, isCreating] = useActionState(createCategoryAction, initialState)
  const [updateState, updateDispatch, isUpdating] = useActionState(updateCategoryAction, initialState)

  const state = isEdit ? updateState : createState
  const isPending = isEdit ? isUpdating : isCreating

  const [name, setName] = useState(category?.name ?? '')
  const [isDefault, setIsDefault] = useState(category?.is_default ?? false)
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (state.status === 'success') {
      addToast({
        title: isEdit ? 'Category updated' : 'Category created',
        color: 'success',
        timeout: 3000,
      })
      onClose()
    }
  }, [state.status]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setClientErrors({})

    const raw = { name, is_default: isDefault }
    const schema = isEdit ? UpdateCategorySchema : CreateCategorySchema
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
      updateDispatch({ id: category.id, ...result.data })
    } else {
      createDispatch(result.data as Parameters<typeof createDispatch>[0])
    }
  }

  const fieldErrors =
    state.status === 'error' && state.fields
      ? Object.fromEntries(Object.entries(state.fields).map(([k, v]) => [k, v[0]]))
      : clientErrors

  const formError = state.status === 'error' && !state.fields ? state.error : null

  return (
    <Modal isOpen size="sm" isDismissable={!isPending} onClose={onClose}>
      <ModalContent>
        <form onSubmit={handleSubmit} noValidate>
          <ModalHeader>{isEdit ? 'Edit Category' : 'New Category'}</ModalHeader>

          <ModalBody className="flex flex-col gap-4">
            {formError && <Alert color="danger" variant="flat" title={formError} />}

            <Input
              label="Name"
              variant="bordered"
              labelPlacement="outside"
              placeholder="e.g. Groceries"
              isRequired
              value={name}
              onValueChange={setName}
              isInvalid={!!fieldErrors.name}
              errorMessage={fieldErrors.name}
            />

            <Switch isSelected={isDefault} onValueChange={setIsDefault}>
              Set as default
            </Switch>
          </ModalBody>

          <ModalFooter className="flex justify-between">
            <div>
              {isEdit && onArchive && (
                <Button
                  color="danger"
                  variant="light"
                  size="sm"
                  isLoading={isArchivePending}
                  isDisabled={isPending}
                  onPress={onArchive}
                  type="button"
                >
                  Archive
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="light" onPress={onClose} isDisabled={isPending} type="button">
                Cancel
              </Button>
              <Button color="primary" type="submit" isLoading={isPending}>
                Save
              </Button>
            </div>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
