import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { NextResponse } from 'next/server'
import { addSystemLog, findUserById, getDb } from '@/lib/app-db'
import { getServerSession, sanitizePublicUser } from '@/lib/auth'
import { syncDocToFirebase } from '@/lib/firebase-db'

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
  }

  if (user.role === 'creator' || user.role === 'admin') {
    return NextResponse.json(
      { ok: false, error: 'บัญชีของคุณมีสิทธิ์อัปโหลดผลงานอยู่แล้ว' },
      { status: 400 },
    )
  }

  try {
    const contentType = request.headers.get('content-type') || ''
    let penName = ''
    let sampleTitle = ''
    let portfolioNote = ''
    let sampleSynopsis = ''
    let coverFile: File | null = null
    let pageFiles: File[] = []

    if (contentType.includes('multipart/form-data')) {
      const fd = await request.formData()
      penName = String(fd.get('penName') || '').trim()
      sampleTitle = String(fd.get('sampleTitle') || '').trim()
      portfolioNote = String(fd.get('portfolioNote') || '').trim()
      sampleSynopsis = String(fd.get('sampleSynopsis') || portfolioNote).trim()
      const c = fd.get('cover')
      if (c && c instanceof File && c.size > 0) coverFile = c
      pageFiles = fd.getAll('pages').filter((f): f is File => f instanceof File && f.size > 0)
    } else {
      const body = await request.json()
      penName = String(body.penName || '').trim()
      sampleTitle = String(body.sampleTitle || '').trim()
      portfolioNote = String(body.portfolioNote || '').trim()
      sampleSynopsis = String(body.sampleSynopsis || portfolioNote).trim()
    }

    if (!penName || !sampleTitle) {
      return NextResponse.json(
        { ok: false, error: 'กรุณากรอกนามปากกา และชื่อเรื่องที่ต้องการลงผลงาน' },
        { status: 400 },
      )
    }

    if (!coverFile && pageFiles.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'กรุณาอัปโหลดภาพปกหรือหน้าผลงานตัวอย่างอย่างน้อย 1 รูป เพื่อให้แอดมินตรวจสอบก่อนให้สิทธิ์',
        },
        { status: 400 },
      )
    }

    const db = getDb()
    const existingPending = db
      .prepare("SELECT id FROM creator_requests WHERE user_id = ? AND status = 'pending' LIMIT 1")
      .get(user.id) as { id: string } | undefined
    if (existingPending) {
      return NextResponse.json(
        { ok: false, error: 'คุณได้ยื่นคำขอไว้แล้ว กรุณารอแอดมินตรวจสอบ' },
        { status: 409 },
      )
    }

    const reqId = `creq-${crypto.randomUUID()}`
    const sampleDir = path.join(process.cwd(), 'public', 'uploads', 'creator-samples', reqId)
    fs.mkdirSync(sampleDir, { recursive: true })

    let sampleCoverUrl: string | null = null
    if (coverFile) {
      const buf = Buffer.from(await coverFile.arrayBuffer())
      const jpg = await sharp(buf).jpeg({ quality: 88 }).toBuffer()
      fs.writeFileSync(path.join(sampleDir, 'cover.jpg'), jpg)
      sampleCoverUrl = `/uploads/creator-samples/${reqId}/cover.jpg`
    }

    const samplePages: string[] = []
    for (let i = 0; i < Math.min(pageFiles.length, 15); i++) {
      const f = pageFiles[i]
      const buf = Buffer.from(await f.arrayBuffer())
      const jpg = await sharp(buf).jpeg({ quality: 86 }).toBuffer()
      const name = `${String(i + 1).padStart(3, '0')}.jpg`
      fs.writeFileSync(path.join(sampleDir, name), jpg)
      samplePages.push(`/uploads/creator-samples/${reqId}/${name}`)
    }

    if (!sampleCoverUrl && samplePages.length > 0) {
      sampleCoverUrl = samplePages[0]
    }

    const now = new Date().toISOString()

    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare(`
        INSERT INTO creator_requests (
          id, user_id, email, display_name, pen_name, sample_title, portfolio_note,
          sample_cover_url, sample_pages_json, sample_synopsis, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(
        reqId,
        user.id,
        user.email,
        user.display_name,
        penName.slice(0, 60),
        sampleTitle.slice(0, 120),
        portfolioNote.slice(0, 500),
        sampleCoverUrl,
        JSON.stringify(samplePages),
        sampleSynopsis.slice(0, 800),
        now,
        now,
      )

      db.prepare("UPDATE users SET creator_status = 'pending', updated_at = ? WHERE id = ?").run(
        now,
        user.id,
      )
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }

    await syncDocToFirebase('creator_requests', reqId, {
      id: reqId,
      userId: user.id,
      email: user.email,
      penName,
      sampleTitle,
      portfolioNote,
      status: 'pending',
      createdAt: now,
    })

    addSystemLog(
      'info',
      'creator-request',
      `${user.email} ยื่นคำขอสิทธิ์ครีเอเตอร์พร้อมผลงานตัวอย่าง "${sampleTitle}" (${samplePages.length} หน้า)`,
      user.email,
    )

    const updated = findUserById(user.id)!
    return NextResponse.json({
      ok: true,
      requestId: reqId,
      sampleCoverUrl,
      samplePagesCount: samplePages.length,
      user: sanitizePublicUser(updated),
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Request failed' }, { status: 500 })
  }
}
