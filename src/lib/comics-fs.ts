import fs from 'node:fs'
import path from 'node:path'

export interface EpisodeFileRecord {
  id: string
  dir: string
  chapterNumber: number
  title: string
  coinPrice: number
  isPreview: boolean
  publishedAt: string
  pages: string[] // Public URL paths e.g. /comics/01-moonlit-sword/ep-01/001.jpg
}

export interface ComicFolderSeries {
  id: string
  slug: string
  folder: string
  title: string
  sub: string
  synopsis: string
  author: string
  origin: 'korea' | 'china' | 'japan'
  status: 'ongoing' | 'completed' | 'hiatus'
  genres: string[]
  rating: number
  views: string
  followers: string
  tone: string
  latestChapter: number
  badge: string
  updateDay: string
  coverUrl: string | null
  episodes: EpisodeFileRecord[]
  isCustomFolder: boolean
}

const COMICS_ROOT = path.join(process.cwd(), 'public', 'comics')
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

const TONE_POOL = [
  'from-emerald-300 to-slate-900',
  'from-rose-300 to-red-950',
  'from-amber-300 to-stone-900',
  'from-violet-300 to-indigo-950',
  'from-sky-200 to-cyan-950',
  'from-lime-300 to-green-950',
  'from-indigo-400 to-rose-950',
  'from-teal-300 to-emerald-950',
  'from-cyan-400 to-fuchsia-950',
  'from-pink-300 to-purple-950',
]

export function getComicsRootDir(): string {
  return COMICS_ROOT
}

function extractEpisodeNumber(dirName: string, fallbackIndex: number): number {
  const match = dirName.match(/(\d+)/)
  if (match) {
    const parsed = Number.parseInt(match[1], 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return fallbackIndex + 1
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function toSafeSlug(folderName: string): string {
  const stripped = folderName.replace(/^\d+[-_\s]*/, '').trim()
  return stripped || folderName
}

export function sanitizeFolderSegment(input: string): string {
  const cleaned = input
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\s+/g, '-')
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error('Invalid folder name')
  }
  return cleaned
}

/**
 * Safely maps a public `/comics/...` URL to an absolute file inside `public/comics/`.
 * Returns null if the path escapes COMICS_ROOT or does not exist.
 */
export function resolveSafeComicImagePath(publicUrlPath: string): string | null {
  try {
    const normalizedUrl = decodeURIComponent(publicUrlPath.split('?')[0])
    if (!normalizedUrl.startsWith('/comics/')) return null
    const rel = normalizedUrl.slice('/comics/'.length)
    const candidate = path.resolve(COMICS_ROOT, rel)
    const rootWithSep = COMICS_ROOT.endsWith(path.sep) ? COMICS_ROOT : COMICS_ROOT + path.sep
    if (!candidate.startsWith(rootWithSep)) return null
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null
    return candidate
  } catch {
    return null
  }
}

/**
 * Dynamically scans `public/comics/<series-folder>/<ep-folder>/*.jpg` on disk.
 * Automatically discovers both starter series (with `meta.json`) and any custom
 * folders/JPEGs placed directly by the user.
 */
export function scanComicsDirectory(): ComicFolderSeries[] {
  if (!fs.existsSync(COMICS_ROOT)) return []

  const entries = fs
    .readdirSync(COMICS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  const results: ComicFolderSeries[] = []

  entries.forEach((entry, idx) => {
    const folder = entry.name
    const seriesDir = path.join(COMICS_ROOT, folder)
    const metaPath = path.join(seriesDir, 'meta.json')

    let meta: Record<string, any> = {}
    let hasMeta = false
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
        hasMeta = true
      } catch {
        hasMeta = false
      }
    }

    const dirContents = fs.readdirSync(seriesDir, { withFileTypes: true })

    // Detect cover file
    let coverFile: string | null = null
    for (const candidate of ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp']) {
      if (dirContents.some((f) => f.isFile() && f.name.toLowerCase() === candidate)) {
        coverFile = dirContents.find((f) => f.isFile() && f.name.toLowerCase() === candidate)!.name
        break
      }
    }

    // Scan episode subfolders
    const subDirs = dirContents
      .filter((d) => d.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

    const metaEpisodes: Array<{ dir?: string; number?: number; title?: string; coinPrice?: number }> =
      Array.isArray(meta.episodes) ? meta.episodes : []

    const episodes: EpisodeFileRecord[] = subDirs
      .map((epEntry, epIdx) => {
        const epPath = path.join(seriesDir, epEntry.name)
        const files = fs
          .readdirSync(epPath, { withFileTypes: true })
          .filter((f) => f.isFile() && IMAGE_EXTENSIONS.has(path.extname(f.name).toLowerCase()))
          .map((f) => f.name)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

        if (files.length === 0) return null

        const metaEp = metaEpisodes.find((m) => m.dir === epEntry.name)
        const chapterNumber = metaEp?.number ?? extractEpisodeNumber(epEntry.name, epIdx)
        const coinPrice = metaEp?.coinPrice ?? (epIdx >= 2 && subDirs.length > 2 ? 5 : 0)

        return {
          id: `${toSafeSlug(folder)}-ep-${chapterNumber}`,
          dir: epEntry.name,
          chapterNumber,
          title: metaEp?.title || `ตอนที่ ${chapterNumber}`,
          coinPrice,
          isPreview: epIdx === subDirs.length - 1,
          publishedAt: `${Math.max(1, subDirs.length - epIdx)} วันที่แล้ว`,
          pages: files.map(
            (file) =>
              `/comics/${encodeURIComponent(folder)}/${encodeURIComponent(epEntry.name)}/${encodeURIComponent(file)}`,
          ),
        } satisfies EpisodeFileRecord
      })
      .filter((x): x is EpisodeFileRecord => x !== null)
      .sort((a, b) => a.chapterNumber - b.chapterNumber)

    const fallbackCover = episodes[0]?.pages[0] ?? null
    const coverUrl = coverFile
      ? `/comics/${encodeURIComponent(folder)}/${encodeURIComponent(coverFile)}`
      : fallbackCover

    const slug = typeof meta.slug === 'string' && meta.slug.trim() ? meta.slug.trim() : toSafeSlug(folder)
    const latestChapter =
      episodes.length > 0
        ? Math.max(...episodes.map((e) => e.chapterNumber))
        : Number(meta.latestChapter || 1)

    results.push({
      id: `folder-${folder}`,
      slug,
      folder,
      title: meta.title || toSafeSlug(folder).replace(/[-_]+/g, ' '),
      sub: meta.sub || toSafeSlug(folder).toUpperCase().replace(/[-_]+/g, ' '),
      synopsis:
        meta.synopsis ||
        `เว็บตูนสุดเข้มข้น พร้อมให้อ่านทั้งหมด ${episodes.length} ตอน อัปเดตความสนุกอย่างต่อเนื่อง`,
      author: meta.author || 'NIVATOON CREATOR',
      origin: ['korea', 'china', 'japan'].includes(meta.origin) ? meta.origin : 'korea',
      status: ['ongoing', 'completed', 'hiatus'].includes(meta.status) ? meta.status : 'ongoing',
      genres: Array.isArray(meta.genres) && meta.genres.length > 0 ? meta.genres : ['action', 'fantasy'],
      rating: typeof meta.rating === 'number' ? meta.rating : 4.8,
      views: meta.views || `${(episodes.length * 1.4 + 2.1).toFixed(1)}M อ่าน`,
      followers: meta.followers || `${120 + episodes.length * 18}K ติดตาม`,
      tone: meta.tone || TONE_POOL[idx % TONE_POOL.length],
      latestChapter,
      badge: meta.badge || (hasMeta ? 'UP' : 'LOCAL'),
      updateDay: meta.updateDay || 'ศุกร์',
      coverUrl,
      episodes,
      isCustomFolder: !hasMeta,
    })
  })

  return results
}

export function getComicSeriesBySlug(slugOrFolder: string): ComicFolderSeries | null {
  const decoded = safeDecode(slugOrFolder)
  const all = scanComicsDirectory()
  return all.find((s) => s.slug === decoded || s.folder === decoded) ?? null
}

export function writeSeriesMetadata(
  folderName: string,
  meta: Partial<ComicFolderSeries> & { episodesMeta?: Array<{ dir: string; number: number; title: string; coinPrice: number }> },
) {
  const safeFolder = sanitizeFolderSegment(folderName)
  const targetDir = path.join(COMICS_ROOT, safeFolder)
  fs.mkdirSync(targetDir, { recursive: true })

  const existingPath = path.join(targetDir, 'meta.json')
  let existing: Record<string, any> = {}
  if (fs.existsSync(existingPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'))
    } catch {}
  }

  const next = {
    ...existing,
    slug: meta.slug || existing.slug || toSafeSlug(safeFolder),
    folder: safeFolder,
    title: meta.title || existing.title || safeFolder,
    sub: meta.sub || existing.sub || safeFolder.toUpperCase(),
    synopsis: meta.synopsis || existing.synopsis || 'เรื่องใหม่ที่เพิ่มผ่าน NIVATOON Studio',
    author: meta.author || existing.author || 'CREATOR STUDIO',
    origin: meta.origin || existing.origin || 'korea',
    status: meta.status || existing.status || 'ongoing',
    genres: meta.genres || existing.genres || ['action', 'fantasy'],
    rating: meta.rating ?? existing.rating ?? 4.9,
    badge: meta.badge || existing.badge || 'ใหม่',
    updateDay: meta.updateDay || existing.updateDay || 'เสาร์',
    tone: meta.tone || existing.tone || TONE_POOL[0],
    episodes: meta.episodesMeta || existing.episodes || [],
  }

  fs.writeFileSync(existingPath, JSON.stringify(next, null, 2), 'utf8')
  return { safeFolder, targetDir, meta: next }
}
