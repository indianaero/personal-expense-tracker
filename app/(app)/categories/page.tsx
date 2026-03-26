import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { fetchCategoriesByUser } from '@/lib/services/categoryService'
import { CategoriesView } from '@/components/categories/CategoriesView'

export default async function CategoriesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const categories = await fetchCategoriesByUser(session.user.id)

  return <CategoriesView categories={categories} />
}
