import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { addSystemLog, findUserByEmail, getDb } from '@/lib/app-db'
import { hashSecret } from '@/lib/auth'
import { sendPasswordResetCodeEmail } from '@/lib/mailer'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'กรุณากรอกอีเมลให้ถูกต้อง' }, { status: 400 })
    }

    const user = findUserByEmail(email)
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'ไม่พบบัญชีที่ใช้อีเมลนี้ในระบบ' },
        { status: 404 },
      )
    }

    const code = String(crypto.randomInt(100000, 1000000))
    const id = `pwr-${crypto.randomUUID()}`
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString()

    const db = getDb()
    db.prepare('UPDATE password_resets SET used = 1 WHERE lower(email) = lower(?) AND used = 0').run(email)
    db.prepare(`
      INSERT INTO password_resets (id, email, code_hash, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(id, email, hashSecret(code), expiresAt, now.toISOString())

    const mailRes = await sendPasswordResetCodeEmail({
      toEmail: user.email,
      displayName: user.display_name,
      code,
    })

    if (!mailRes.configured) {
      addSystemLog(
        'warn',
        'auth-otp',
        `สร้างรหัสกู้คืน 6 หลักสำหรับ ${email} (ยังไม่ตั้งค่า SMTP — รหัสทดสอบสำหรับแอดมิน: ${code})`,
        email,
      )
      return NextResponse.json({
        ok: true,
        sentViaEmail: false,
        message:
          'สร้างคำขอรหัสกู้คืน 6 หลักแล้ว (กรุณาให้แอดมินตั้งค่า SMTP Email ใน Admin Dashboard เพื่อส่งเมลอัตโนมัติ หรือดูบันทึกใน System Logs)',
      })
    }

    if (!mailRes.sent) {
      addSystemLog(
        'error',
        'auth-otp',
        `ส่งอีเมล OTP ไปยัง ${email} ไม่สำเร็จ: ${mailRes.rawError || mailRes.error}`,
        email,
      )
      return NextResponse.json(
        { ok: false, error: mailRes.error || 'ไม่สามารถส่งอีเมลได้ กรุณาตรวจสอบการตั้งค่า SMTP ใน Admin' },
        { status: 500 },
      )
    }

    addSystemLog('info', 'auth-otp', `ส่งรหัสยืนยัน 6 หลักไปยังอีเมล ${email} เรียบร้อย`, email)
    return NextResponse.json({
      ok: true,
      sentViaEmail: true,
      message: `ส่งรหัส CODE 6 หลักไปยังอีเมล ${email} แล้ว (หมดอายุใน 15 นาที)`,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Request failed' }, { status: 500 })
  }
}
