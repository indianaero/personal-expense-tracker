'use client'
import { Skeleton } from '@heroui/react'

interface Props {
  height?: string
}

export function ChartSkeleton({ height = 'h-64' }: Props) {
  return <Skeleton className={`w-full ${height} rounded-xl`} />
}
