import { redirect } from 'next/navigation'
import { Home } from '@/components/manga/site'
import { getServerSession } from '@/lib/auth'
import { fetchSeriesFromDatabase } from '@/lib/database-server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    redirect('/login')
  }
  if (!session.unlocked) {
    redirect('/security-gate')
  }

  const { series } = await fetchSeriesFromDatabase()
  return <Home initialSeries={series} />
}
