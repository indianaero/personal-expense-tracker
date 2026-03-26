'use client'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react'
import type { Expense } from '@/types/models'

interface Props {
  expense: Expense
  onConfirm: () => void
  onClose: () => void
  isPending: boolean
}

export function DeleteExpenseModal({ expense, onConfirm, onClose, isPending }: Props) {
  return (
    <Modal isOpen size="sm" isDismissable={false} onClose={onClose}>
      <ModalContent>
        <ModalHeader>Delete Expense</ModalHeader>
        <ModalBody>
          <p>
            Are you sure you want to delete{' '}
            <strong>{expense.description}</strong>? This cannot be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={isPending}>
            Cancel
          </Button>
          <Button color="danger" isLoading={isPending} onPress={onConfirm}>
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
