'use client'
import { Card, CardBody, CardHeader, Skeleton } from '@heroui/react'

export default function SummaryLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-7 w-40 rounded-lg" />
          <Skeleton className="h-4 w-28 rounded-md" />
        </div>
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} shadow="sm" radius="lg">
            <CardBody className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-8 w-36 rounded-md" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Category breakdown */}
      <Card shadow="sm">
        <CardHeader>
          <Skeleton className="h-5 w-44 rounded-md" />
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-6 w-28 rounded-full" />
              <div className="flex gap-6">
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-md" />
                <Skeleton className="h-4 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
