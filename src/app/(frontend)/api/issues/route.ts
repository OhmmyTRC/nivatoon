import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { addSystemLog, getDb, getUserIssues } from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'
import { syncDocToFirebase } from '@/lib/firebase-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ ok: true, issues: getUserIssues(user.id) })
}

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อนแจ้งปัญหา' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const category = String(body.category || 'general').trim().slice(0, 40)
    const subject = String(body.subject || '').trim().slice(0, 120)
    const description = String(body.description || '').trim().slice(0, 1200)
    const pageUrl = body.pageUrl ? String(body.pageUrl).trim().slice(0, 200) : null

    if (!subject || !description) {
      return NextResponse.json(
        { ok: false, error: 'กรุณากรอกหัวข้อและรายละเอียดปัญหาที่พบ' },
        { status: 400 },
      )
    }

    const id = `iss-${crypto.randomUUID()}`
    const now = new Date().toISOString()

    getDb()
      .prepare(`
        INSERT INTO issue_reports (
          id, user_id, user_email, user_name, category, subject, description, page_url, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
      `)
      .run(id, user.id, user.email, user.display_name, category, subject, description, pageUrl, now, now)

    const created = getDb().prepare('SELECT * FROM issue_reports WHERE id = ?').get(id) as Record<string, unknown>
    await syncDocToFirebase('issue_reports', id, created)
    addSystemLog('info', 'support', `แจ้งปัญหาใหม่: [${category}] ${subject}`, user.email)

    return NextResponse.json({ ok: true, issue: created })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Failed' }, { status: 500 })
  }
}
