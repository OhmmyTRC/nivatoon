import { NextResponse } from 'next/server'
import { addSystemLog, findUserById, getDb } from '@/lib/app-db'
import {
  buildSessionCookieConfig,
  getServerSession,
  hashSecret,
  sanitizePublicUser,
  verifySecret,
} from '@/lib/auth'
import { syncDocToFirebase } from '@/lib/firebase-db'

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const currentPin = String(body.currentPin || '').trim()
    const currentPassword = String(body.currentPassword || '')
    const newPin = String(body.newPin || '').trim()

    if (!/^\d{6}$/.test(newPin)) {
      return NextResponse.json(
        { ok: false, error: 'กรุณากรอกรหัส PIN ใหม่เป็นตัวเลข 6 หลัก' },
        { status: 400 },
      )
    }

    if (user.pin_hash) {
      const validOldPin = currentPin && verifySecret(currentPin, user.pin_hash)
      const validPassword = currentPassword && verifySecret(currentPassword, user.password_hash)
      if (!validOldPin && !validPassword) {
        return NextResponse.json(
          { ok: false, error: 'รหัส PIN ปัจจุบัน หรือรหัสผ่านบัญชีไม่ถูกต้อง' },
          { status: 401 },
        )
      }
    } else if (!currentPassword || !verifySecret(currentPassword, user.password_hash)) {
      return NextResponse.json(
        { ok: false, error: 'กรุณายืนยันรหัสผ่านบัญชีให้ถูกต้องก่อนตั้ง PIN ใหม่' },
        { status: 401 },
      )
    }

    const now = new Date().toISOString()
    const newPinHash = hashSecret(newPin)
    getDb()
      .prepare('UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?')
      .run(newPinHash, now, user.id)

    await syncDocToFirebase('users', user.id, { pin_hash: newPinHash, updated_at: now })
    addSystemLog('security', 'auth', `เปลี่ยนรหัส PIN 6 หลักสำเร็จ (${user.email})`, user.email)

    const updated = findUserById(user.id)!
    const cookieCfg = buildSessionCookieConfig(user.id, true)
    const res = NextResponse.json({
      ok: true,
      unlocked: true,
      token: cookieCfg.value,
      user: sanitizePublicUser(updated),
      message: 'เปลี่ยนรหัส PIN 6 หลักเรียบร้อยแล้ว ✓',
    })
    res.cookies.set(cookieCfg)
    return res
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Change PIN failed' }, { status: 500 })
  }
}
