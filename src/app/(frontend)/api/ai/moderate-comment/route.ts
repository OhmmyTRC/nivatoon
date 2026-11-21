import { NextResponse } from 'next/server'
import { moderateCommentWithGemini } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { comment, seriesTitle = 'Manhwa', chapterNumber = 1 } = body as {
      comment?: string
      seriesTitle?: string
      chapterNumber?: number
    }

    if (!comment || !comment.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing comment' }, { status: 400 })
    }

    const result = await moderateCommentWithGemini({
      comment: comment.trim(),
      seriesTitle,
      chapterNumber: Number(chapterNumber) || 1,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    )
  }
}
