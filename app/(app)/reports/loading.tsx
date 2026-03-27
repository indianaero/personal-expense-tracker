'use client'
import { Card, CardBody, CardHeader, Skeleton } from '@heroui/react'

export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i} shadow="sm">
            <CardHeader>
              <Skeleton className="h-5 w-36 rounded-md" />
            </CardHeader>
            <CardBody>
              <Skeleton className={`w-full rounded-xl ${i === 0 ? 'h-64' : 'h-72'}`} />
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Category breakdown */}
      <Card shadow="sm">
        <CardHeader>
          <Skeleton className="h-5 w-40 rounded-md" />
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
