'use client'
import { Skeleton, Card, CardBody, CardHeader } from '@heroui/react'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} shadow="sm" radius="lg">
            <CardBody className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24 rounded-lg" />
              <Skeleton className="h-8 w-32 rounded-lg" />
              <Skeleton className="h-5 w-20 rounded-lg" />
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Breakdown table */}
      <Card shadow="sm">
        <CardHeader>
          <Skeleton className="h-5 w-48 rounded-lg" />
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </CardBody>
      </Card>

      {/* Recent expenses */}
      <Card shadow="sm">
        <CardHeader className="flex items-center justify-between">
          <Skeleton className="h-5 w-36 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
