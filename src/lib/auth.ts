import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { cookies, headers } from 'next/headers'
import { findUserById, type DbUserRow } from './app-db'

export const SESSION_COOKIE_NAME = 'nivatoon_session'

function getSessionSecret(): string {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    return process.env.AUTH_SECRET
  }
  const secretPath = path.join(process.cwd(), 'data', '.auth-secret')
  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf8').trim()
    }
    fs.mkdirSync(path.dirname(secretPath), { recursive: true })
    const generated = crypto.randomBytes(32).toString('hex')
    fs.writeFileSync(secretPath, generated, { mode: 0o600 })
    return generated
  } catch {
    return crypto.createHash('sha256').update(process.cwd()).digest('hex')
  }
}

export function hashSecret(raw: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(raw, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export function verifySecret(raw: string, storedHash: string | null): boolean {
  if (!storedHash || !storedHash.includes(':')) return false
  const [salt, keyHex] = storedHash.split(':')
  const keyBuf = Buffer.from(keyHex, 'hex')
  const derived = crypto.scryptSync(raw, salt, 64)
  if (keyBuf.length !== derived.length) return false
  return crypto.timingSafeEqual(keyBuf, derived)
}

export interface SessionPayload {
  userId: string
  unlocked: boolean
  exp: number
}

export function signSessionToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(data)
    .digest('base64url')
  return `${data}.${sig}`
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes('.')) return null
  const [data, sig] = token.split('.')
  const expected = crypto
    .createHmac('sha256', getSessionSecret())
    .update(data)
    .digest('base64url')

  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload
    if (!parsed.userId || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/**
 * Resolves session from HttpOnly cookie (Web/PWA) OR Authorization Bearer token (Flutter mobile app).
 */
export async function getServerSession(): Promise<{
  session: SessionPayload | null
  user: DbUserRow | null
}> {
  try {
    let raw: string | undefined
    const hdrs = await headers()
    const authHeader = hdrs.get('authorization') || ''
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      raw = authHeader.slice(7).trim()
    }
    if (!raw) {
      const jar = await cookies()
      raw = jar.get(SESSION_COOKIE_NAME)?.value
    }
    const session = verifySessionToken(raw)
    if (!session) return { session: null, user: null }
    const user = findUserById(session.userId)
    if (!user) return { session: null, user: null }
    return { session, user }
  } catch {
    return { session: null, user: null }
  }
}

export function buildSessionCookieConfig(userId: string, unlocked: boolean) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000
  const token = signSessionToken({ userId, unlocked, exp })
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  }
}

export function sanitizePublicUser(u: DbUserRow) {
  return {
    id: u.id,
    email: u.email,
    provider: u.provider,
    role: u.role || 'user',
    creatorStatus: u.creator_status || 'none',
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    avatarFrame: u.avatar_frame,
    bio: u.bio,
    bannerTheme: u.banner_theme,
    coinBalance: u.coin_balance,
    freePassTickets: u.free_pass_tickets,
    plan: u.plan,
    checkinDay: u.checkin_day ?? 0,
    lastCheckinDate: u.last_checkin_date,
    themeMode: (u.theme_mode === 'dark' ? 'dark' : 'light') as 'light' | 'dark',
    hasPin: Boolean(u.pin_hash),
    hasBiometric: Boolean(u.biometric_credential_id),
    biometricCredentialId: u.biometric_credential_id,
    biometricLabel: u.biometric_label,
  }
}
