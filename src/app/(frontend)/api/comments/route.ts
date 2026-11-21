import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { type DbCommentRow, getDb } from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'
import { syncDocToFirebase } from '@/lib/firebase-db'
import { moderateCommentWithGemini } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const seriesSlug = url.searchParams.get('seriesSlug')
  const chapterNumber = url.searchParams.get('chapterNumber')
  const db = getDb()

  let rows: DbCommentRow[]
  if (seriesSlug && chapterNumber) {
    rows = db
      .prepare(
        'SELECT * FROM comments WHERE series_slug = ? AND chapter_number = ? ORDER BY is_top DESC, likes DESC, created_at DESC LIMIT 60',
      )
      .all(seriesSlug, Number(chapterNumber)) as unknown as DbCommentRow[]
  } else {
    rows = db
      .prepare('SELECT * FROM comments ORDER BY created_at DESC LIMIT 40')
      .all() as unknown as DbCommentRow[]
  }

  return NextResponse.json({ ok: true, comments: rows })
}

export async function POST(request: Request) {
  try {
    const { user } = await getServerSession()
    const body = await request.json()
    const seriesSlug = String(body.seriesSlug || '').trim()
    const chapterNumber = Number(body.chapterNumber || 1)
    const seriesTitle = String(body.seriesTitle || seriesSlug)
    const text = String(body.body || body.text || '').trim()

    if (!seriesSlug || !text) {
      return NextResponse.json({ ok: false, error: 'กรุณาพิมพ์ข้อความคอมเมนต์' }, { status: 400 })
    }

    const mod = await moderateCommentWithGemini({
      comment: text,
      seriesTitle,
      chapterNumber,
    })

    const db = getDb()
    const id = `c-${crypto.randomUUID()}`
    const now = new Date().toISOString()
    const authorName = user?.display_name || String(body.authorName || 'นักอ่านทั่วไป')
    const authorAvatar = user?.avatar_url ?? null
    const authorBadge =
      user?.role === 'admin'
        ? 'ADMIN'
        : user?.role === 'creator'
          ? 'CREATOR'
          : user?.plan === 'plus'
            ? 'PLUS'
            : user
              ? 'MEMBER'
              : 'GUEST'

    db.prepare(`
      INSERT INTO comments (
        id, user_id, series_slug, chapter_number, author_name, author_avatar, author_badge, body, likes, is_top, is_spoiler, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
    `).run(
      id,
      user?.id ?? null,
      seriesSlug,
      chapterNumber,
      authorName,
      authorAvatar,
      authorBadge,
      text,
      mod.isSpoiler ? 1 : 0,
      now,
    )

    const created = db
      .prepare('SELECT * FROM comments WHERE id = ?')
      .get(id) as unknown as DbCommentRow
    await syncDocToFirebase('comments', id, { ...created })
    return NextResponse.json({ ok: true, comment: created, moderation: mod })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Comment failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const commentId = String(body.commentId || '').trim()
    if (!commentId) {
      return NextResponse.json({ ok: false, error: 'Missing commentId' }, { status: 400 })
    }
    const db = getDb()
    db.prepare('UPDATE comments SET likes = likes + 1 WHERE id = ?').run(commentId)
    const updated = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId) as DbCommentRow | undefined
    return NextResponse.json({ ok: true, comment: updated ?? null })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Failed' }, { status: 500 })
  }
}
