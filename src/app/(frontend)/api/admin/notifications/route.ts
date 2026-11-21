import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { addSystemLog, getDb } from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'
import { deleteDocFromFirebase, syncDocToFirebase } from '@/lib/firebase-db'

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden: Admin only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const title = String(body.title || '').trim().slice(0, 120)
    const message = String(body.message || '').trim().slice(0, 400)
    const type = ['promo', 'announcement', 'update'].includes(String(body.type))
      ? String(body.type)
      : 'promo'
    const badge = String(body.badge || (type === 'promo' ? 'PROMO' : 'NEWS')).trim().slice(0, 20)
    const ctaUrl = body.ctaUrl ? String(body.ctaUrl).trim().slice(0, 150) : '/wallet/topup'

    if (!title || !message) {
      return NextResponse.json({ ok: false, error: 'กรุณากรอกหัวข้อและข้อความแจ้งเตือน' }, { status: 400 })
    }

    const id = `notif-${crypto.randomUUID()}`
    const now = new Date().toISOString()

    getDb()
      .prepare(`
        INSERT INTO notifications (id, title, message, type, badge, cta_url, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      `)
      .run(id, title, message, type, badge, ctaUrl, now)

    const created = getDb().prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Record<string, unknown>
    await syncDocToFirebase('notifications', id, created)
    addSystemLog('info', 'admin-promo', `ประกาศแจ้งเตือนใหม่: ${title}`, user.email)

    return NextResponse.json({ ok: true, notification: created })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden: Admin only' }, { status: 403 })
  }

  const body = await request.json()
  const id = String(body.id || '').trim()
  const isActive = body.isActive ? 1 : 0
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })

  getDb().prepare('UPDATE notifications SET is_active = ? WHERE id = ?').run(isActive, id)
  await syncDocToFirebase('notifications', id, { is_active: isActive })
  return NextResponse.json({ ok: true, id, isActive })
}

export async function DELETE(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden: Admin only' }, { status: 403 })
  }

  const id = new URL(request.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })

  getDb().prepare('DELETE FROM notifications WHERE id = ?').run(id)
  await deleteDocFromFirebase('notifications', id)
  addSystemLog('info', 'admin-promo', `ลบการแจ้งเตือน ${id}`, user.email)
  return NextResponse.json({ ok: true, deletedId: id })
}
