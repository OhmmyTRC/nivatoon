import { NextResponse } from 'next/server'
import { getNotificationsWithReadState, markNotificationsReadForUser } from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { session, user } = await getServerSession()
  const { notifications, readIds, unreadCount } = getNotificationsWithReadState(
    session && user ? user.id : null,
    25,
  )

  return NextResponse.json({
    ok: true,
    notifications,
    readIds,
    unreadCount,
  })
}

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: true, readIds: [], unreadCount: 0 })
  }

  let ids: string[] | undefined
  try {
    const body = await request.json()
    if (Array.isArray(body?.notificationIds)) {
      ids = body.notificationIds.map((x: unknown) => String(x)).filter(Boolean)
    }
  } catch {}

  markNotificationsReadForUser(user.id, ids)
  const state = getNotificationsWithReadState(user.id, 25)

  return NextResponse.json({
    ok: true,
    ...state,
  })
}
