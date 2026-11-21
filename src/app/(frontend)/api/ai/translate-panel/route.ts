import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { resolveSafeComicImagePath } from '@/lib/comics-fs'
import { translateComicPanelWithGemini } from '@/lib/gemini'

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { imageUrl, seriesTitle = 'Manhwa', chapterNumber = 1 } = body as {
      imageUrl?: string
      seriesTitle?: string
      chapterNumber?: number
    }

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ ok: false, error: 'กรุณาระบุ imageUrl ของหน้าการ์ตูน' }, { status: 400 })
    }

    const filePath = resolveSafeComicImagePath(imageUrl)
    if (!filePath) {
      return NextResponse.json(
        { ok: false, error: 'ไม่พบภาพหน้าการ์ตูนที่ต้องการแปล' },
        { status: 404 },
      )
    }

    const ext = path.extname(filePath).toLowerCase()
    const mimeType = MIME_BY_EXT[ext] ?? 'image/jpeg'
    const imageBase64 = fs.readFileSync(filePath).toString('base64')

    const result = await translateComicPanelWithGemini({
      imageBase64,
      mimeType,
      seriesTitle,
      chapterNumber: Number(chapterNumber) || 1,
    })

    if (result.error && result.error !== 'MISSING_GEMINI_API_KEY') {
      return NextResponse.json({ ok: false, configured: result.configured, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, configured: true, error: err?.message || String(err) },
      { status: 500 },
    )
  }
}
