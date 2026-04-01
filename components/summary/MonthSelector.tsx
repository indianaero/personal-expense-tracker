'use client'
import { Select, SelectItem } from '@heroui/react'
import { useRouter, usePathname } from 'next/navigation'

interface Props {
  year: number
  month: number
}

function buildMonthOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()

  for (let i = 0; i < 13; i++) {
    let m = now.getMonth() + 1 - i
    let y = now.getFullYear()
    while (m <= 0) {
      m += 12
      y--
    }
    const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
    options.push({ value: `${y}-${m}`, label })
  }

  return options
}

const MONTH_OPTIONS = buildMonthOptions()

export function MonthSelector({ year, month }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function handleChange(keys: 'all' | Set<React.Key>) {
    if (keys === 'all') return
    const key = Array.from(keys)[0] as string
    if (!key) return
    const [y, m] = key.split('-')
    router.push(`${pathname}?year=${y}&month=${m}`)
  }

  return (
    <Select
      aria-label="Select month"
      size="sm"
      variant="bordered"
      className="w-48"
      selectionMode="single"
      selectedKeys={new Set([`${year}-${month}`])}
      onSelectionChange={handleChange}
    >
      {MONTH_OPTIONS.map((opt) => (
        <SelectItem key={opt.value}>
          {opt.label}
        </SelectItem>
      ))}
    </Select>
  )
}
