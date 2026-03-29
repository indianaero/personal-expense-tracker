'use client'
import { useState, useOptimistic, useTransition } from 'react'
import {
  Tabs,
  Tab,
  Card,
  CardBody,
  CardFooter,
  Avatar,
  Chip,
  Button,
  addToast,
} from '@heroui/react'
import { Plus } from 'lucide-react'
import { archiveCategoryAction } from '@/lib/actions/category'
import { CategoryFormModal } from './CategoryFormModal'
import type { Category } from '@/types/models'

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; category: Category }

interface Props {
  categories: Category[]
}

function EmptyState({ tab, onCreateClick }: { tab: string; onCreateClick: () => void }) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-12">
        <p className="text-xl font-semibold">
          {tab === 'active' ? 'No categories yet' : 'No archived categories'}
        </p>
        {tab === 'active' && (
          <>
            <p className="text-default-400 text-sm">Create a category to organize your expenses.</p>
            <Button color="primary" size="sm" onPress={onCreateClick}>
              Create a category
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  )
}

export function CategoriesView({ categories: initialCategories }: Props) {
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [categories, optimisticUpdate] = useOptimistic(
    initialCategories,
    (current: Category[], update: Partial<Category> & { id: string }) =>
      current.map((c) => (c.id === update.id ? { ...c, ...update } : c)),
  )

  const active = categories.filter((c) => !c.is_archived)
  const archived = categories.filter((c) => c.is_archived)

  function handleArchive(category: Category) {
    const archiving = !category.is_archived
    setArchivingId(category.id)
    startTransition(async () => {
      optimisticUpdate({ id: category.id, is_archived: archiving })
      const result = await archiveCategoryAction({ id: category.id, archive: archiving })
      setArchivingId(null)
      if (result.status === 'error') {
        addToast({ title: result.error, color: 'danger', timeout: 6000 })
      } else {
        addToast({
          title: archiving ? 'Category archived' : 'Category restored',
          color: archiving ? 'default' : 'success',
          timeout: 3000,
        })
        if (modal.type === 'edit') setModal({ type: 'none' })
      }
    })
  }

  function CategoryCard({ category }: { category: Category }) {
    const isOwned = !!category.user_id
    const isArchiving = archivingId === category.id

    return (
      <Card
        shadow="sm"
        isPressable={isOwned}
        onPress={isOwned ? () => setModal({ type: 'edit', category }) : undefined}
      >
        <CardBody className="flex flex-col items-center gap-2 py-6">
          <Avatar
            name={category.name[0]?.toUpperCase()}
            size="md"
            radius="sm"
            color="primary"
          />
          <p className="font-semibold text-center">{category.name}</p>
          <Chip variant="flat" size="sm" color={category.is_default ? 'primary' : 'default'}>
            {category.is_default ? 'Default' : 'Custom'}
          </Chip>
        </CardBody>

        {category.is_archived && (
          <CardFooter className="justify-center pt-0 pb-3">
            <Button
              size="sm"
              variant="light"
              color="success"
              isLoading={isArchiving}
              isDisabled={isPending}
              onPress={() => handleArchive(category)}
            >
              Restore
            </Button>
          </CardFooter>
        )}
      </Card>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4 p-6">
        <Tabs aria-label="Categories" variant="underlined" color="primary">
          <Tab key="active" title="Active">
            {active.length === 0 ? (
              <EmptyState tab="active" onCreateClick={() => setModal({ type: 'create' })} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 mt-4">
                {active.map((c) => (
                  <CategoryCard key={c.id} category={c} />
                ))}
              </div>
            )}
          </Tab>

          <Tab key="archived" title={`Archived${archived.length > 0 ? ` (${archived.length})` : ''}`}>
            {archived.length === 0 ? (
              <EmptyState tab="archived" onCreateClick={() => setModal({ type: 'create' })} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 mt-4">
                {archived.map((c) => (
                  <CategoryCard key={c.id} category={c} />
                ))}
              </div>
            )}
          </Tab>
        </Tabs>
      </div>

      {/* FAB */}
      <Button
        color="primary"
        radius="full"
        isIconOnly
        aria-label="Add category"
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-30 shadow-lg"
        onPress={() => setModal({ type: 'create' })}
      >
        <Plus size={20} />
      </Button>

      {modal.type === 'create' && (
        <CategoryFormModal onClose={() => setModal({ type: 'none' })} />
      )}

      {modal.type === 'edit' && (
        <CategoryFormModal
          category={modal.category}
          onClose={() => setModal({ type: 'none' })}
          onArchive={() => handleArchive(modal.category as Category)}
          isArchivePending={archivingId === (modal.category as Category).id}
        />
      )}
    </>
  )
}
