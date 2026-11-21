import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import {
  getComicsRootDir,
  sanitizeFolderSegment,
  scanComicsDirectory,
  writeSeriesMetadata,
} from '@/lib/comics-fs'
import { syncDocToFirebase } from '@/lib/firebase-db'

export async function GET() {
  const { user } = await getServerSession()
  if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
    return NextResponse.json({ ok: false, error: 'Creator or Admin only' }, { status: 403 })
  }
  const series = scanComicsDirectory()
  return NextResponse.json({
    ok: true,
    count: series.length,
    series: series.map((s) => ({
      folder: s.folder,
      slug: s.slug,
      title: s.title,
      coverUrl: s.coverUrl,
      episodes: s.episodes.map((e) => ({
        dir: e.dir,
        chapterNumber: e.chapterNumber,
        title: e.title,
        pageCount: e.pages.length,
      })),
    })),
  })
}

export async function POST(request: Request) {
  const { user } = await getServerSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
  }
  if (user.role !== 'creator' && user.role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'เฉพาะบัญชี Creator หรือ Admin เท่านั้นที่อัปโหลดผลงานได้' },
      { status: 403 },
    )
  }
  try {
    const formData = await request.formData()
    const folderRaw = String(formData.get('folder') || '').trim()
    const title = String(formData.get('title') || '').trim()
    const sub = String(formData.get('sub') || '').trim()
    const author = String(formData.get('author') || '').trim()
    const origin = String(formData.get('origin') || 'korea').trim() as 'korea' | 'china' | 'japan'
    const synopsis = String(formData.get('synopsis') || '').trim()
    const updateDay = String(formData.get('updateDay') || 'เสาร์').trim()
    const genresRaw = String(formData.get('genres') || 'action,fantasy')
    const episodeDirRaw = String(formData.get('episodeDir') || 'ep-01').trim()
    const episodeTitle = String(formData.get('episodeTitle') || '').trim()
    const coinPrice = Number(formData.get('coinPrice') || 0)

    if (!folderRaw) {
      return NextResponse.json({ ok: false, error: 'กรุณาระบุชื่อโฟลเดอร์เรื่อง' }, { status: 400 })
    }

    const safeFolder = sanitizeFolderSegment(folderRaw)
    const safeEpDir = sanitizeFolderSegment(episodeDirRaw)
    const root = getComicsRootDir()
    const seriesDir = path.join(root, safeFolder)
    const epDir = path.join(seriesDir, safeEpDir)
    fs.mkdirSync(epDir, { recursive: true })

    // Cover upload (optional)
    const coverFile = formData.get('cover')
    if (coverFile && coverFile instanceof File && coverFile.size > 0) {
      const buf = Buffer.from(await coverFile.arrayBuffer())
      const jpg = await sharp(buf).jpeg({ quality: 90 }).toBuffer()
      fs.writeFileSync(path.join(seriesDir, 'cover.jpg'), jpg)
    }

    // Episode pages upload (supports multi-file upload, converted cleanly to numbered 001.jpg, 002.jpg, ...)
    const pageFiles = formData.getAll('pages').filter((f): f is File => f instanceof File && f.size > 0)
    const existingCount = fs
      .readdirSync(epDir)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).length

    const savedPages: string[] = []
    for (let i = 0; i < pageFiles.length; i++) {
      const file = pageFiles[i]
      const buf = Buffer.from(await file.arrayBuffer())
      const jpg = await sharp(buf).jpeg({ quality: 88 }).toBuffer()
      const filename = `${String(existingCount + i + 1).padStart(3, '0')}.jpg`
      fs.writeFileSync(path.join(epDir, filename), jpg)
      savedPages.push(`/comics/${encodeURIComponent(safeFolder)}/${encodeURIComponent(safeEpDir)}/${filename}`)
    }

    // Update meta.json with episode entry
    const metaPath = path.join(seriesDir, 'meta.json')
    let existingEpisodes: Array<{ dir: string; number: number; title: string; coinPrice: number }> = []
    if (fs.existsSync(metaPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
        if (Array.isArray(parsed.episodes)) existingEpisodes = parsed.episodes
      } catch {}
    }

    const epNumMatch = safeEpDir.match(/(\d+)/)
    const epNumber = epNumMatch ? Number.parseInt(epNumMatch[1], 10) : existingEpisodes.length + 1
    const filteredEps = existingEpisodes.filter((e) => e.dir !== safeEpDir)
    filteredEps.push({
      dir: safeEpDir,
      number: epNumber,
      title: episodeTitle || `ตอนที่ ${epNumber}`,
      coinPrice: Number.isFinite(coinPrice) ? coinPrice : 0,
    })
    filteredEps.sort((a, b) => a.number - b.number)

    const { meta } = writeSeriesMetadata(safeFolder, {
      title: title || undefined,
      sub: sub || undefined,
      author: author || undefined,
      origin: ['korea', 'china', 'japan'].includes(origin) ? origin : 'korea',
      synopsis: synopsis || undefined,
      updateDay,
      genres: genresRaw
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean),
      episodesMeta: filteredEps,
    })

    const seriesSlug = String(meta.slug || safeFolder)
    await syncDocToFirebase('series', seriesSlug, {
      slug: seriesSlug,
      folder: safeFolder,
      title: meta.title || safeFolder,
      sub: meta.sub || '',
      author: meta.author || user.display_name,
      authorId: user.id,
      origin: meta.origin || 'korea',
      status: meta.status || 'ongoing',
      genres: Array.isArray(meta.genres) ? meta.genres : ['action'],
      synopsis: meta.synopsis || '',
      updateDay: meta.updateDay || updateDay,
      episodesCount: filteredEps.length,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      ok: true,
      folder: safeFolder,
      episodeDir: safeEpDir,
      savedPages,
      meta,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
