import { NextResponse } from 'next/server'
import { addSystemLog, getDb } from '@/lib/app-db'
import { getServerSession, hashSecret, verifySecret } from '@/lib/auth'

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const currentPassword = String(body.currentPassword || '')
    const newPassword = String(body.newPassword || '')

    if (!currentPassword || !verifySecret(currentPassword, user.password_hash)) {
      return NextResponse.json({ ok: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 401 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 },
      )
    }

    getDb()
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashSecret(newPassword), new Date().toISOString(), user.id)

    addSystemLog('info', 'auth', `เปลี่ยนรหัสผ่านสำเร็จ (${user.email})`, user.email)
    return NextResponse.json({ ok: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Change failed' }, { status: 500 })
  }
}
