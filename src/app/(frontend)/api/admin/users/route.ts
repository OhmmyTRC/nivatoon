import { NextResponse } from 'next/server'
import { findUserById, getDb, type UserRole } from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'
import { syncDocToFirebase } from '@/lib/firebase-db'

const VALID_ROLES = new Set<UserRole>(['user', 'creator', 'admin'])

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden: Admin only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const targetUserId = String(body.userId || '').trim()
    const nextRole = String(body.role || '').trim() as UserRole

    if (!targetUserId || !VALID_ROLES.has(nextRole)) {
      return NextResponse.json({ ok: false, error: 'Invalid userId or role' }, { status: 400 })
    }

    const target = findUserById(targetUserId)
    if (!target) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const nextCreatorStatus = nextRole === 'creator' || nextRole === 'admin' ? 'approved' : 'none'
    getDb()
      .prepare('UPDATE users SET role = ?, creator_status = ?, updated_at = ? WHERE id = ?')
      .run(nextRole, nextCreatorStatus, now, targetUserId)

    await syncDocToFirebase('users', targetUserId, {
      role: nextRole,
      creatorStatus: nextCreatorStatus,
      updatedAt: now,
    })

    return NextResponse.json({ ok: true, userId: targetUserId, role: nextRole })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Failed' }, { status: 500 })
  }
}
