import { NextResponse } from 'next/server'
import { findUserById, getDb } from '@/lib/app-db'
import {
  buildSessionCookieConfig,
  getServerSession,
  hashSecret,
  sanitizePublicUser,
  verifySecret,
} from '@/lib/auth'

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const action = String(body.action || '')
    const db = getDb()
    const now = new Date().toISOString()

    if (action === 'set_pin') {
      const pin = String(body.pin || '').trim()
      if (!/^\d{6}$/.test(pin)) {
        return NextResponse.json(
          { ok: false, error: 'กรุณากรอกรหัส PIN ตัวเลข 6 หลัก' },
          { status: 400 },
        )
      }
      db.prepare('UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?').run(
        hashSecret(pin),
        now,
        user.id,
      )
      const updated = findUserById(user.id)!
      const cookieCfg = buildSessionCookieConfig(user.id, true)
      const res = NextResponse.json({
        ok: true,
        unlocked: true,
        token: cookieCfg.value,
        user: sanitizePublicUser(updated),
      })
      res.cookies.set(cookieCfg)
      return res
    }

    if (action === 'verify_pin') {
      const pin = String(body.pin || '').trim()
      if (!user.pin_hash) {
        return NextResponse.json(
          { ok: false, error: 'คุณยังไม่ได้ตั้งรหัส PIN กรุณาตั้งรหัส PIN 6 หลักก่อน' },
          { status: 400 },
        )
      }
      if (!verifySecret(pin, user.pin_hash)) {
        return NextResponse.json(
          { ok: false, error: 'รหัส PIN 6 หลักไม่ถูกต้อง' },
          { status: 401 },
        )
      }
      const cookieCfg = buildSessionCookieConfig(user.id, true)
      const res = NextResponse.json({
        ok: true,
        unlocked: true,
        token: cookieCfg.value,
        user: sanitizePublicUser(user),
      })
      res.cookies.set(cookieCfg)
      return res
    }

    if (action === 'register_biometric') {
      const credentialId = String(body.credentialId || '').trim()
      const label = String(body.label || 'Fingerprint / Passkey').trim()
      if (!credentialId || credentialId.length < 8) {
        return NextResponse.json(
          { ok: false, error: 'ไม่พบข้อมูล Credential ID จากอุปกรณ์สแกนลายนิ้วมือ' },
          { status: 400 },
        )
      }
      db.prepare(
        'UPDATE users SET biometric_credential_id = ?, biometric_label = ?, updated_at = ? WHERE id = ?',
      ).run(credentialId, label, now, user.id)
      const updated = findUserById(user.id)!
      const cookieCfg = buildSessionCookieConfig(user.id, true)
      const res = NextResponse.json({
        ok: true,
        unlocked: true,
        token: cookieCfg.value,
        user: sanitizePublicUser(updated),
      })
      res.cookies.set(cookieCfg)
      return res
    }

    if (action === 'verify_biometric') {
      const credentialId = String(body.credentialId || '').trim()
      if (!user.biometric_credential_id || credentialId !== user.biometric_credential_id) {
        return NextResponse.json(
          { ok: false, error: 'ลายนิ้วมือ / Passkey ไม่ตรงกับบัญชีที่ลงทะเบียนไว้' },
          { status: 401 },
        )
      }
      const cookieCfg = buildSessionCookieConfig(user.id, true)
      const res = NextResponse.json({
        ok: true,
        unlocked: true,
        token: cookieCfg.value,
        user: sanitizePublicUser(user),
      })
      res.cookies.set(cookieCfg)
      return res
    }

    if (action === 'lock') {
      const res = NextResponse.json({ ok: true, unlocked: false })
      res.cookies.set(buildSessionCookieConfig(user.id, false))
      return res
    }

    return NextResponse.json({ ok: false, error: 'Unsupported action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Security error' }, { status: 500 })
  }
}
