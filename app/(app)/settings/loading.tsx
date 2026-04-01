'use client'
import { Card, CardBody, CardHeader, Skeleton, Divider } from '@heroui/react'

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-lg">
      {/* Heading */}
      <div className="flex flex-col gap-1">
        <Skeleton className="h-7 w-24 rounded-lg" />
        <Skeleton className="h-4 w-48 rounded-md" />
      </div>

      {/* Profile card */}
      <Card shadow="sm">
        <CardHeader>
          <Skeleton className="h-5 w-16 rounded-md" />
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-3 w-44 rounded-md" />
            </div>
          </div>
          <Divider />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <div className="flex justify-end">
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </CardBody>
      </Card>

      {/* Preferences card */}
      <Card shadow="sm">
        <CardHeader>
          <Skeleton className="h-5 w-24 rounded-md" />
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <Skeleton className="h-14 w-full rounded-lg" />
          <div className="flex justify-end">
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
          <Divider />
          <Skeleton className="h-14 w-full rounded-lg" />
        </CardBody>
      </Card>

      {/* Danger zone */}
      <Card shadow="sm">
        <CardHeader>
          <Skeleton className="h-5 w-28 rounded-md" />
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </CardBody>
      </Card>
    </div>
  )
}
