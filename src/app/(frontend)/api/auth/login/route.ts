import { NextResponse } from 'next/server'
import { addSystemLog, findUserByEmail } from '@/lib/app-db'
import { buildSessionCookieConfig, sanitizePublicUser, verifySecret } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' },
        { status: 400 },
      )
    }

    const user = findUserByEmail(email)
    if (!user || !verifySecret(password, user.password_hash)) {
      addSystemLog('warn', 'auth', `เข้าสู่ระบบไม่สำเร็จสำหรับอีเมล ${email}`, email)
      return NextResponse.json(
        { ok: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 },
      )
    }

    const cookieCfg = buildSessionCookieConfig(user.id, false)
    addSystemLog('info', 'auth', `ผู้ใช้ ${user.email} (${user.role}) เข้าสู่ระบบ`, user.email)

    const res = NextResponse.json({
      ok: true,
      token: cookieCfg.value,
      user: sanitizePublicUser(user),
      requiresSecurityGate: true,
    })
    res.cookies.set(cookieCfg)
    return res
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Login failed' }, { status: 500 })
  }
}
