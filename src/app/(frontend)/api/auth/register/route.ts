import { NextResponse } from 'next/server'
import { addSystemLog, createDbUser, findUserByEmail, getDb } from '@/lib/app-db'
import { buildSessionCookieConfig, hashSecret, sanitizePublicUser } from '@/lib/auth'
import { syncDocToFirebase } from '@/lib/firebase-db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const displayName = String(body.displayName || '').trim()
    const pin = body.pin ? String(body.pin).trim() : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: 'กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@gmail.com)' },
        { status: 400 },
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 },
      )
    }

    if (pin && !/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { ok: false, error: 'รหัส PIN ความปลอดภัยต้องเป็นตัวเลข 6 หลัก' },
        { status: 400 },
      )
    }

    if (findUserByEmail(email)) {
      return NextResponse.json(
        { ok: false, error: 'อีเมลนี้ถูกสมัครใช้งานแล้ว กรุณาเข้าสู่ระบบ' },
        { status: 409 },
      )
    }

    const user = createDbUser({
      email,
      passwordHash: hashSecret(password),
      role: 'user',
      displayName: displayName || email.split('@')[0],
    })

    if (pin) {
      getDb()
        .prepare('UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?')
        .run(hashSecret(pin), new Date().toISOString(), user.id)
    }

    await syncDocToFirebase('users', user.id, {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      creatorStatus: user.creator_status,
      coinBalance: user.coin_balance,
      freePassTickets: user.free_pass_tickets,
      createdAt: user.created_at,
    })

    addSystemLog(
      'info',
      'auth',
      `สมัครสมาชิกใหม่: ${user.email} (พอยน์ 0, ตั๋วอ่านฟรี 3)`,
      user.email,
    )

    const cookieCfg = buildSessionCookieConfig(user.id, false)
    const res = NextResponse.json({
      ok: true,
      token: cookieCfg.value,
      user: sanitizePublicUser(user),
      requiresSecurityGate: true,
    })
    res.cookies.set(cookieCfg)
    return res
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Register failed' }, { status: 500 })
  }
}
