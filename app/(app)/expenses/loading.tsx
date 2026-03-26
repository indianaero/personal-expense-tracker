'use client'
import { Skeleton } from '@heroui/react'

export default function ExpensesLoading() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-24 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}
