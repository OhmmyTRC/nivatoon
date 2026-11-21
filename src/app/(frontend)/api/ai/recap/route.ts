import { NextResponse } from 'next/server'
import { getComicSeriesBySlug } from '@/lib/comics-fs'
import { STARTER_SERIES } from '@/lib/database'
import { askSpoilerSafeCompanion } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      seriesSlug,
      currentChapter = 1,
      question,
      previousInteractionId,
    } = body as {
      seriesSlug?: string
      currentChapter?: number
      question?: string
      previousInteractionId?: string
    }

    if (!seriesSlug) {
      return NextResponse.json({ ok: false, error: 'Missing seriesSlug' }, { status: 400 })
    }

    const folderSeries = getComicSeriesBySlug(seriesSlug)
    const fallback = STARTER_SERIES.find((s) => s.slug === seriesSlug)
    const series = folderSeries ?? fallback

    if (!series) {
      return NextResponse.json({ ok: false, error: 'Series not found' }, { status: 404 })
    }

    const priorEpisodeTitles = (folderSeries?.episodes ?? []).map((e) => ({
      number: e.chapterNumber,
      title: e.title,
    }))

    const result = await askSpoilerSafeCompanion({
      seriesTitle: series.title,
      synopsis: series.synopsis,
      origin: series.origin,
      genres: series.genres,
      currentChapter: Number(currentChapter) || 1,
      priorEpisodeTitles,
      question,
      previousInteractionId,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    )
  }
}
