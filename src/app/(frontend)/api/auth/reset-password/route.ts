import { NextResponse } from 'next/server'
import { addSystemLog, findUserByEmail, getDb } from '@/lib/app-db'
import { hashSecret, verifySecret } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const code = String(body.code || '').replace(/\D/g, '')
    const newPassword = String(body.newPassword || '')

    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { ok: false, error: 'กรุณากรอกอีเมลและรหัส CODE 6 หลักให้ครบถ้วน' },
        { status: 400 },
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 },
      )
    }

    const user = findUserByEmail(email)
    if (!user) {
      return NextResponse.json({ ok: false, error: 'ไม่พบบัญชีอีเมลนี้' }, { status: 404 })
    }

    const db = getDb()
    const resetRow = db
      .prepare(
        'SELECT * FROM password_resets WHERE lower(email) = lower(?) AND used = 0 ORDER BY created_at DESC LIMIT 1',
      )
      .get(email) as
      | { id: string; code_hash: string; expires_at: string }
      | undefined

    if (!resetRow) {
      return NextResponse.json(
        { ok: false, error: 'ไม่พบคำขอกู้คืนรหัสผ่าน หรือรหัสถูกใช้งานไปแล้ว' },
        { status: 400 },
      )
    }

    if (Date.now() > new Date(resetRow.expires_at).getTime()) {
      db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id)
      return NextResponse.json(
        { ok: false, error: 'รหัส CODE 6 หลักหมดอายุแล้ว กรุณาขอรหัสใหม่อีกครั้ง' },
        { status: 400 },
      )
    }

    if (!verifySecret(code, resetRow.code_hash)) {
      addSystemLog('warn', 'auth-otp', `กรอกรหัส OTP กู้คืนรหัสผ่านผิดสำหรับ ${email}`, email)
      return NextResponse.json({ ok: false, error: 'รหัส CODE 6 หลักไม่ถูกต้อง' }, { status: 401 })
    }

    const now = new Date().toISOString()
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        hashSecret(newPassword),
        now,
        user.id,
      )
      db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }

    addSystemLog('info', 'auth-otp', `รีเซ็ตรหัสผ่านด้วย CODE 6 หลักสำเร็จสำหรับ ${email}`, email)
    return NextResponse.json({
      ok: true,
      message: 'รีเซ็ตรหัสผ่านสำเร็จแล้ว สามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที',
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Reset failed' }, { status: 500 })
  }
}
