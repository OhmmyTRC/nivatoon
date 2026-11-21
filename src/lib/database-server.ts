import { getPayloadClient } from './payload'
import { type ComicFolderSeries, scanComicsDirectory } from './comics-fs'
import {
  type ComicSeriesRecord,
  STARTER_SERIES,
} from './database'

function mapFolderSeries(f: ComicFolderSeries): ComicSeriesRecord {
  return {
    id: f.id,
    slug: f.slug,
    folder: f.folder,
    title: f.title,
    sub: f.sub,
    synopsis: f.synopsis,
    author: f.author,
    origin: f.origin,
    status: f.status,
    genres: f.genres,
    rating: f.rating,
    views: f.views,
    followers: f.followers,
    tone: f.tone,
    latestChapter: f.latestChapter,
    badge: f.badge,
    updateDay: f.updateDay,
    coverUrl: f.coverUrl,
    episodes: f.episodes,
    isCustomFolder: f.isCustomFolder,
  }
}

/**
 * Server-only loader: scans `public/comics/` for real per-series / per-episode JPEG folders
 * and merges gracefully with Payload CMS database when connected.
 */
export async function fetchSeriesFromDatabase(): Promise<{
  series: ComicSeriesRecord[]
  source: 'comics-fs' | 'payload-db' | 'firebase-seed'
}> {
  const folderSeries = scanComicsDirectory().map(mapFolderSeries)

  try {
    const payload = await getPayloadClient()
    const existing = await payload.find({
      collection: 'series',
      limit: 50,
      overrideAccess: true,
    })

    if (existing.docs.length === 0 && folderSeries.length > 0) {
      for (const item of folderSeries.slice(0, 10)) {
        await payload.create({
          collection: 'series',
          overrideAccess: true,
          data: {
            title: item.title,
            slug: item.slug,
            subtitle: item.sub,
            synopsis: item.synopsis,
            origin: item.origin,
            status: item.status,
            genres: item.genres as any,
            rating: item.rating,
            author: item.author,
            _status: 'published',
          },
        })
      }
    }

    if (folderSeries.length > 0) {
      return { series: folderSeries, source: 'comics-fs' }
    }

    if (existing.docs.length > 0) {
      const mapped: ComicSeriesRecord[] = existing.docs.map((doc, i) => {
        const fallback =
          STARTER_SERIES.find((s) => s.slug === doc.slug) ??
          STARTER_SERIES[i % STARTER_SERIES.length]
        return {
          ...fallback,
          id: String(doc.id),
          slug: doc.slug || fallback.slug,
          title: doc.title,
          sub: doc.subtitle || fallback.sub,
          synopsis: doc.synopsis,
          author: doc.author,
          origin: doc.origin,
          status: doc.status,
          genres: (doc.genres as string[]) ?? fallback.genres,
          rating: doc.rating ?? fallback.rating,
        }
      })
      return { series: mapped, source: 'payload-db' }
    }
  } catch {
    // Safe fallback when running locally without Figma Cloud DB env vars
  }

  if (folderSeries.length > 0) {
    return { series: folderSeries, source: 'comics-fs' }
  }

  return { series: STARTER_SERIES, source: 'firebase-seed' }
}
