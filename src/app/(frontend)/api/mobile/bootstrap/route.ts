import { NextResponse } from 'next/server'
import { getNotificationsWithReadState, getUserDashboardBundle } from '@/lib/app-db'
import { getServerSession, sanitizePublicUser } from '@/lib/auth'
import { fetchSeriesFromDatabase } from '@/lib/database-server'
import { getFirebaseStatus } from '@/lib/firebase-db'
import {
  COIN_PACKAGES,
  PLUS_PACKAGE,
  PROMPTPAY_ACCOUNT_NAME,
  PROMPTPAY_RECIPIENT_ID,
  TRUEMONEY_ACCOUNT_NAME,
  TRUEMONEY_RECIPIENT_ID,
} from '@/lib/promptpay'

export const dynamic = 'force-dynamic'

/**
 * Unified mobile bootstrap endpoint optimized for Flutter (`Authorization: Bearer <token>`)
 * and PWA clients: loads auth profile, series catalog, notifications, and payment info in 1 roundtrip.
 */
export async function GET() {
  const { session, user } = await getServerSession()
  const { series } = await fetchSeriesFromDatabase()
  const { notifications, readIds, unreadCount } = getNotificationsWithReadState(
    session && user ? user.id : null,
    15,
  )
  const firebaseStatus = getFirebaseStatus()

  const bundle = session && user ? getUserDashboardBundle(user.id) : null

  return NextResponse.json({
    ok: true,
    apiVersion: '2026-11-flutter-v1',
    authenticated: Boolean(session && user),
    unlocked: Boolean(session?.unlocked),
    user: user ? sanitizePublicUser(user) : null,
    firebaseStatus,
    notifications,
    readNotificationIds: readIds,
    unreadNotificationCount: unreadCount,
    series,
    paymentConfig: {
      promptpayId: PROMPTPAY_RECIPIENT_ID,
      promptpayAccountName: PROMPTPAY_ACCOUNT_NAME,
      truemoneyId: TRUEMONEY_RECIPIENT_ID,
      truemoneyAccountName: TRUEMONEY_ACCOUNT_NAME,
      coinPackages: COIN_PACKAGES,
      plusPackage: PLUS_PACKAGE,
    },
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
  })
}
