import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { resolveSafeComicImagePath } from '@/lib/comics-fs'
import { generateVoiceDramaFromPanel } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { imageUrl, seriesTitle = 'Manhwa', chapterNumber = 1, fallbackText } = body as {
      imageUrl?: string
      seriesTitle?: string
      chapterNumber?: number
      fallbackText?: string
    }

    let imageBase64: string | undefined
    let mimeType: string | undefined

    if (imageUrl) {
      const filePath = resolveSafeComicImagePath(imageUrl)
      if (filePath) {
        const ext = path.extname(filePath).toLowerCase()
        mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
        imageBase64 = fs.readFileSync(filePath).toString('base64')
      }
    }

    const result = await generateVoiceDramaFromPanel({
      imageBase64,
      mimeType,
      seriesTitle,
      chapterNumber: Number(chapterNumber) || 1,
      fallbackLineText: fallbackText,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    )
  }
}
