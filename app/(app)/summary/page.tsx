import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getMonthlySummary } from '@/lib/services/summaryService'
import { fetchCategoriesByUser } from '@/lib/services/categoryService'
import { SummaryView } from '@/components/summary/SummaryView'

const SummaryParamsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const raw = await searchParams
  const now = new Date()
  const parsed = SummaryParamsSchema.safeParse({
    year: raw.year ?? String(now.getFullYear()),
    month: raw.month ?? String(now.getMonth() + 1),
  })
  const { year, month } = parsed.success
    ? parsed.data
    : { year: now.getFullYear(), month: now.getMonth() + 1 }

  const [summary, categories] = await Promise.all([
    getMonthlySummary(session.user.id, year, month),
    fetchCategoriesByUser(session.user.id),
  ])

  return (
    <SummaryView
      summary={summary}
      categories={categories}
      year={year}
      month={month}
    />
  )
}
