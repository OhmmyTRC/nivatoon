import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { NextResponse } from 'next/server'
import { findUserById, getDb } from '@/lib/app-db'
import { getServerSession, sanitizePublicUser } from '@/lib/auth'
import { syncDocToFirebase } from '@/lib/firebase-db'

const AVATAR_FRAMES = new Set(['emerald', 'gold', 'neon', 'rose', 'royal'])
const BANNER_THEMES = new Set(['midnight', 'emerald', 'amber', 'rose', 'cyber'])

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อนแก้ไขโปรไฟล์' }, { status: 401 })
  }

  try {
    const contentType = request.headers.get('content-type') || ''
    let displayName = user.display_name
    let bio = user.bio
    let avatarFrame = user.avatar_frame
    let bannerTheme = user.banner_theme
    let avatarUrl = user.avatar_url

    if (contentType.includes('multipart/form-data')) {
      const fd = await request.formData()
      const rawName = fd.get('displayName')
      if (typeof rawName === 'string' && rawName.trim()) {
        displayName = rawName.trim().slice(0, 60)
      }
      const rawBio = fd.get('bio')
      if (typeof rawBio === 'string') {
        bio = rawBio.trim().slice(0, 240)
      }
      const rawFrame = fd.get('avatarFrame')
      if (typeof rawFrame === 'string' && AVATAR_FRAMES.has(rawFrame)) {
        avatarFrame = rawFrame
      }
      const rawBanner = fd.get('bannerTheme')
      if (typeof rawBanner === 'string' && BANNER_THEMES.has(rawBanner)) {
        bannerTheme = rawBanner
      }
      const presetAvatar = fd.get('presetAvatarUrl')
      if (typeof presetAvatar === 'string' && presetAvatar.startsWith('/comics/')) {
        avatarUrl = presetAvatar
      }

      const file = fd.get('avatar')
      if (file && file instanceof File && file.size > 0) {
        const avatarDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
        fs.mkdirSync(avatarDir, { recursive: true })
        const buf = Buffer.from(await file.arrayBuffer())
        const jpg = await sharp(buf)
          .resize(320, 320, { fit: 'cover' })
          .jpeg({ quality: 88 })
          .toBuffer()
        const safeName = `${user.id.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}.jpg`
        fs.writeFileSync(path.join(avatarDir, safeName), jpg)
        avatarUrl = `/uploads/avatars/${safeName}`
      }
    } else {
      const body = await request.json()
      if (typeof body.displayName === 'string' && body.displayName.trim()) {
        displayName = body.displayName.trim().slice(0, 60)
      }
      if (typeof body.bio === 'string') {
        bio = body.bio.trim().slice(0, 240)
      }
      if (typeof body.avatarFrame === 'string' && AVATAR_FRAMES.has(body.avatarFrame)) {
        avatarFrame = body.avatarFrame
      }
      if (typeof body.bannerTheme === 'string' && BANNER_THEMES.has(body.bannerTheme)) {
        bannerTheme = body.bannerTheme
      }
      if (typeof body.presetAvatarUrl === 'string' && body.presetAvatarUrl.startsWith('/comics/')) {
        avatarUrl = body.presetAvatarUrl
      }
    }

    const db = getDb()
    db.prepare(
      'UPDATE users SET display_name = ?, bio = ?, avatar_frame = ?, banner_theme = ?, avatar_url = ?, updated_at = ? WHERE id = ?',
    ).run(displayName, bio, avatarFrame, bannerTheme, avatarUrl, new Date().toISOString(), user.id)

    const updated = findUserById(user.id)!
    const nowIso = new Date().toISOString()
    await syncDocToFirebase('users', updated.id, {
      displayName: updated.display_name,
      bio: updated.bio,
      avatarFrame: updated.avatar_frame,
      bannerTheme: updated.banner_theme,
      avatarUrl: updated.avatar_url,
      updatedAt: nowIso,
    })
    await syncDocToFirebase('users_public', updated.id, {
      id: updated.id,
      displayName: updated.display_name,
      avatarUrl: updated.avatar_url,
      avatarFrame: updated.avatar_frame,
      bio: updated.bio,
      bannerTheme: updated.banner_theme,
      role: updated.role,
      updatedAt: nowIso,
    })
    return NextResponse.json({ ok: true, user: sanitizePublicUser(updated) })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Profile update failed' }, { status: 500 })
  }
}
