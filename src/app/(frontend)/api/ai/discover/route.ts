import { NextResponse } from 'next/server'
import { fetchSeriesFromDatabase } from '@/lib/database-server'
import { discoverByMoodWithGemini } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { query } = body as { query?: string }

    if (!query || !query.trim()) {
      return NextResponse.json({ ok: false, error: 'กรุณาพิมพ์ฟีลหรือแนวเรื่องที่อยากอ่าน' }, { status: 400 })
    }

    const { series } = await fetchSeriesFromDatabase()
    const result = await discoverByMoodWithGemini({
      query: query.trim(),
      catalog: series.map((s) => ({
        slug: s.slug,
        title: s.title,
        sub: s.sub,
        origin: s.origin,
        genres: s.genres,
        synopsis: s.synopsis,
        rating: s.rating,
      })),
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    )
  }
}
