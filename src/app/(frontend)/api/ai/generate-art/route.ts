import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { getComicsRootDir, sanitizeFolderSegment } from '@/lib/comics-fs'
import { generateManhwaImageWithGemini } from '@/lib/gemini'

export async function POST(request: Request) {
  const { user } = await getServerSession()
  if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
    return NextResponse.json(
      { ok: false, error: 'เฉพาะบัญชี Creator หรือ Admin เท่านั้นที่ใช้งาน Studio วาดปกได้' },
      { status: 403 },
    )
  }
  try {
    const body = await request.json()
    const {
      prompt,
      saveToFolder,
      saveAs = 'cover',
      episodeDir = 'ep-01',
    } = body as {
      prompt?: string
      saveToFolder?: string
      saveAs?: 'cover' | 'panel'
      episodeDir?: string
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ ok: false, error: 'กรุณาใส่คำบรรยายภาพ (Prompt)' }, { status: 400 })
    }

    const gen = await generateManhwaImageWithGemini(prompt.trim())
    if (!gen.configured || !gen.imageBase64) {
      return NextResponse.json({ ok: true, ...gen, savedUrl: null })
    }

    const jpgBuffer = await sharp(Buffer.from(gen.imageBase64, 'base64'))
      .resize(720, saveAs === 'cover' ? 960 : 1280, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer()

    let savedUrl: string | null = null
    if (saveToFolder && saveToFolder.trim()) {
      const safeFolder = sanitizeFolderSegment(saveToFolder)
      const root = getComicsRootDir()
      if (saveAs === 'cover') {
        const dir = path.join(root, safeFolder)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, 'cover.jpg'), jpgBuffer)
        savedUrl = `/comics/${encodeURIComponent(safeFolder)}/cover.jpg`
      } else {
        const safeEp = sanitizeFolderSegment(episodeDir)
        const dir = path.join(root, safeFolder, safeEp)
        fs.mkdirSync(dir, { recursive: true })
        const existing = fs
          .readdirSync(dir)
          .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        const nextNum = String(existing.length + 1).padStart(3, '0')
        const filename = `${nextNum}.jpg`
        fs.writeFileSync(path.join(dir, filename), jpgBuffer)
        savedUrl = `/comics/${encodeURIComponent(safeFolder)}/${encodeURIComponent(safeEp)}/${filename}`
      }
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      imageBase64: jpgBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      savedUrl,
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    )
  }
}
