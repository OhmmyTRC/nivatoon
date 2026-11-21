import { NextResponse } from 'next/server'
import { getUserDashboardBundle } from '@/lib/app-db'
import { getServerSession, sanitizePublicUser } from '@/lib/auth'
import { getFirebaseStatus } from '@/lib/firebase-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { session, user } = await getServerSession()

  const firebaseStatus = getFirebaseStatus()

  if (!session || !user) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      unlocked: false,
      user: null,
      bundle: null,
      firebaseConnected: firebaseStatus.adminConnected,
      firebaseStatus,
    })
  }

  const bundle = getUserDashboardBundle(user.id)
  return NextResponse.json({
    ok: true,
    authenticated: true,
    unlocked: session.unlocked,
    user: sanitizePublicUser(user),
    bundle: bundle
      ? {
          librarySlugs: bundle.librarySlugs,
          unlockedChapterIds: bundle.unlockedChapterIds,
          unlockedChapters: bundle.unlockedChapters,
          readingHistory: bundle.readingHistory,
          transactions: bundle.transactions,
          latestCreatorRequest: bundle.latestCreatorRequest,
          issues: bundle.issues,
        }
      : null,
    firebaseConnected: firebaseStatus.adminConnected,
    firebaseStatus,
  })
}
