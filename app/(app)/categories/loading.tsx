'use client'
import { Skeleton, Card, CardBody } from '@heroui/react'

export default function CategoriesLoading() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-10 w-48 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 mt-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i} shadow="sm">
            <CardBody className="flex flex-col items-center gap-2 py-6">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-5 w-24 rounded-lg" />
              <Skeleton className="h-5 w-16 rounded-lg" />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
