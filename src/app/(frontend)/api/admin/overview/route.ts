import { NextResponse } from 'next/server'
import { getAnalyticsDashboardData } from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'
import { scanComicsDirectory } from '@/lib/comics-fs'
import { getFirebaseStatus, pullCloudStateFromFirebase } from '@/lib/firebase-db'
import { getGitHubStorageStatus, toGitHubRawUrl } from '@/lib/github-storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'Forbidden: เฉพาะแอดมินเท่านั้นที่เข้าถึงข้อมูลหลังบ้านได้' },
      { status: 403 },
    )
  }

  // Pull any mobile-originated records from Firebase before building dashboard analytics
  await pullCloudStateFromFirebase()

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
      githubCoverUrl: toGitHubRawUrl(match?.coverUrl ?? null),
      origin: match?.origin ?? 'korea',
      episodesCount: match?.episodes.length ?? 0,
    }
  })

  const firebaseStatus = getFirebaseStatus()
  const githubStorage = getGitHubStorageStatus()

  return NextResponse.json({
    ok: true,
    firebaseConnected: firebaseStatus.adminConnected,
    firebaseStatus,
    githubStorage,
    summary: analytics.summary,
    topSpenders: analytics.topSpenders,
    popularSeries: popularSeriesEnriched,
    recentTransactions: analytics.recentTransactions,
    recentComments: analytics.recentComments,
    creatorRequests: analytics.creatorRequests,
    allUsers: analytics.allUsers,
    recentLogs: analytics.recentLogs,
    issueReports: analytics.issueReports,
    notifications: analytics.notifications,
  })
}
