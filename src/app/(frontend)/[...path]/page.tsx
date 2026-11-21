import { notFound, redirect } from 'next/navigation'
import {
  AiDiscoverPage,
  AnalyticsDashboardPage,
  AuthPage,
  CanvasPage,
  DashboardPage,
  ListingPage,
  RankingPage,
  ReaderPage,
  routes,
  SchedulePage,
  SecurityGatePage,
  SeriesPage,
  StudioPage,
} from '@/components/manga/site'
import { getServerSession } from '@/lib/auth'
import { fetchSeriesFromDatabase } from '@/lib/database-server'

export const dynamic = 'force-dynamic'

const PUBLIC_UNAUTH_ROUTES = new Set([
  'login',
  'register',
  'forgot-password',
  'security-gate',
  'help',
  'terms',
  'privacy',
])

export default async function CatchAllPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const segments = (await params).path
  const resolvedSearch = searchParams ? await searchParams : {}
  const initialTopupPkg =
    typeof resolvedSearch.package === 'string' ? resolvedSearch.package : undefined
  const value = segments.join('/')

  if (!PUBLIC_UNAUTH_ROUTES.has(value)) {
    const { session, user } = await getServerSession()
    if (!session || !user) {
      redirect('/login')
    }
    if (!session.unlocked) {
      redirect('/security-gate')
    }
  }

  if (['login', 'register', 'forgot-password'].includes(value)) {
    return <AuthPage mode={value} />
  }

  if (value === 'security-gate') {
    return <SecurityGatePage />
  }

  const { series } = await fetchSeriesFromDatabase()

  if (value === 'dashboard') {
    return <AnalyticsDashboardPage initialSeries={series} />
  }

  if (value === 'schedule') {
    return <SchedulePage initialSeries={series} />
  }

  if (value === 'canvas') {
    return <CanvasPage initialSeries={series} />
  }

  if (value === 'ranking') {
    return <RankingPage initialSeries={series} />
  }

  if (value === 'ai-discover') {
    return <AiDiscoverPage initialSeries={series} />
  }

  if (value === 'studio') {
    return <StudioPage initialSeries={series} />
  }

  if (segments[0] === 'series' && segments[1]) {
    return <SeriesPage initialSeries={series} slug={segments[1]} />
  }

  if (segments[0] === 'read' && segments[1]) {
    const chNum = Number(segments[2] || 1)
    return <ReaderPage initialSeries={series} slug={segments[1]} chapterNumber={chNum} />
  }

  if (
    [
      'discover',
      'latest',
      'popular',
      'completed',
      'korean',
      'chinese',
      'japanese',
      'genres/action',
      'genres/romance',
      'search',
    ].includes(value)
  ) {
    return <ListingPage initialSeries={series} path={value} />
  }

  if (!routes.includes(value)) notFound()
  return (
    <DashboardPage
      initialSeries={series}
      path={value}
      initialTopupPkg={initialTopupPkg}
    />
  )
}
