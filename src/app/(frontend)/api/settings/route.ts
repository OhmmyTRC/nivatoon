import { NextResponse } from 'next/server'
import { addSystemLog, findUserById, getDb } from '@/lib/app-db'
import { getServerSession, sanitizePublicUser } from '@/lib/auth'
import { syncDocToFirebase } from '@/lib/firebase-db'

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const themeMode = body.themeMode === 'dark' ? 'dark' : 'light'
    const now = new Date().toISOString()

    getDb()
      .prepare('UPDATE users SET theme_mode = ?, updated_at = ? WHERE id = ?')
      .run(themeMode, now, user.id)

    const updated = findUserById(user.id)!
    await syncDocToFirebase('users', updated.id, {
      updatedAt: now,
    })
    addSystemLog('info', 'settings', `อัปเดตธีม ${themeMode} (${user.email})`, user.email)

    return NextResponse.json({
      ok: true,
      themeMode,
      user: sanitizePublicUser(updated),
      message: 'บันทึกการตั้งค่าเรียบร้อยแล้ว',
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Failed' }, { status: 500 })
  }
}
