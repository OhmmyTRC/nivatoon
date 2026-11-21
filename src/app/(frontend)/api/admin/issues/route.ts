import { NextResponse } from 'next/server'
import { addSystemLog, getDb } from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'
import { syncDocToFirebase } from '@/lib/firebase-db'

const VALID_STATUSES = new Set(['open', 'investigating', 'resolved'])

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden: Admin only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const issueId = String(body.issueId || '').trim()
    const status = String(body.status || 'resolved').trim()
    const adminReply = String(body.adminReply || '').trim()

    if (!issueId || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ ok: false, error: 'Invalid issueId or status' }, { status: 400 })
    }

    const now = new Date().toISOString()
    getDb()
      .prepare('UPDATE issue_reports SET status = ?, admin_reply = ?, updated_at = ? WHERE id = ?')
      .run(status, adminReply, now, issueId)

    await syncDocToFirebase('issue_reports', issueId, { status, admin_reply: adminReply, updated_at: now })
    addSystemLog('info', 'admin-support', `ตอบกลับปัญหา ${issueId} -> สถานะ ${status}`, user.email)

    return NextResponse.json({ ok: true, issueId, status })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Failed' }, { status: 500 })
  }
}
