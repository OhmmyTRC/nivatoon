import { NextResponse } from 'next/server'
import { getAnalyticsDashboardData } from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'
import { scanComicsDirectory } from '@/lib/comics-fs'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { session, user } = await getServerSession()
  if (!session || !user || user.role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'Forbidden: เฉพาะ Admin เท่านั้นที่เข้าถึง Dashboard หลังบ้านได้' },
      { status: 403 },
    )
  }

  const analytics = getAnalyticsDashboardData()
  const seriesCatalog = scanComicsDirectory()

  const popularSeriesEnriched = analytics.popularSeries.map((stat) => {
    const match = seriesCatalog.find(
      (s) => s.slug === stat.series_slug || s.folder === stat.series_slug,
    )
    return {
      ...stat,
      title: match?.title ?? stat.series_slug,
      sub: match?.sub ?? stat.series_slug.toUpperCase(),
      coverUrl: match?.coverUrl ?? null,
      origin: match?.origin ?? 'korea',
      episodesCount: match?.episodes.length ?? 0,
    }
  })

  return NextResponse.json({
    ok: true,
    summary: analytics.summary,
    topSpenders: analytics.topSpenders,
    popularSeries: popularSeriesEnriched,
    recentTransactions: analytics.recentTransactions,
    recentComments: analytics.recentComments,
    creatorRequests: analytics.creatorRequests,
    allUsers: analytics.allUsers,
  })
}
