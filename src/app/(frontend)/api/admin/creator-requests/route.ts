import { NextResponse } from 'next/server'
import { findUserById, getDb, type DbCreatorRequestRow } from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'
import { syncDocToFirebase } from '@/lib/firebase-db'

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
    const requestId = String(body.requestId || '').trim()
    const decision = body.decision === 'approve' ? 'approved' : body.decision === 'reject' ? 'rejected' : null
    const reviewNote = String(body.reviewNote || '').trim()

    if (!requestId || !decision) {
      return NextResponse.json({ ok: false, error: 'Invalid requestId or decision' }, { status: 400 })
    }

    const db = getDb()
    const reqRow = db
      .prepare('SELECT * FROM creator_requests WHERE id = ? LIMIT 1')
      .get(requestId) as unknown as DbCreatorRequestRow | undefined

    if (!reqRow) {
      return NextResponse.json({ ok: false, error: 'Creator request not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare(
        'UPDATE creator_requests SET status = ?, reviewed_by = ?, review_note = ?, updated_at = ? WHERE id = ?',
      ).run(decision, user.id, reviewNote, now, requestId)

      if (decision === 'approved') {
        db.prepare(
          "UPDATE users SET role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'creator' END, creator_status = 'approved', updated_at = ? WHERE id = ?",
        ).run(now, reqRow.user_id)
      } else {
        db.prepare(
          "UPDATE users SET creator_status = 'rejected', updated_at = ? WHERE id = ?",
        ).run(now, reqRow.user_id)
      }
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }

    const targetUser = findUserById(reqRow.user_id)
    await syncDocToFirebase('creator_requests', requestId, {
      status: decision,
      reviewedBy: user.id,
      reviewNote,
      updatedAt: now,
    })
    if (targetUser) {
      await syncDocToFirebase('users', targetUser.id, {
        role: targetUser.role,
        creatorStatus: targetUser.creator_status,
      })
    }

    return NextResponse.json({ ok: true, decision, requestId })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Failed' }, { status: 500 })
  }
}
