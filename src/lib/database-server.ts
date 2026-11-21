import fs from 'node:fs'
import path from 'node:path'
import { getPayloadClient } from './payload'
import { type ComicFolderSeries, scanComicsDirectory } from './comics-fs'
import {
  type ComicSeriesRecord,
  STARTER_SERIES,
} from './database'
import {
  fetchComicsManifestFromGitHub,
  generateAndSaveComicsManifest,
} from './github-storage'

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
 * Server-only loader: scans `public/comics/` (backed by GitHub repository `OhmmyTRC/nivatoon`),
 * keeps `public/comics/manifest.json` up to date, falls back to GitHub Raw manifest when needed,
 * and merges gracefully with Payload CMS / Firebase database.
 */
export async function fetchSeriesFromDatabase(): Promise<{
  series: ComicSeriesRecord[]
  source: 'comics-fs' | 'github-storage' | 'payload-db' | 'firebase-seed'
}> {
  const folderSeries = scanComicsDirectory().map(mapFolderSeries)

  if (folderSeries.length > 0) {
    try {
      const manifestPath = path.join(process.cwd(), 'public', 'comics', 'manifest.json')
      if (!fs.existsSync(manifestPath)) {
        generateAndSaveComicsManifest()
      }
    } catch {}
  }

  try {
    const payload = await getPayloadClient()
    const existing = await payload.find({
      collection: 'series',
      limit: 50,
      overrideAccess: true,
    })

    if (existing.docs.length === 0 && folderSeries.length > 0) {
      for (const item of folderSeries.slice(0, 11)) {
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

  // Fallback to GitHub Raw storage manifest (`https://raw.githubusercontent.com/OhmmyTRC/nivatoon/main/public/comics/manifest.json`)
  const ghManifest = await fetchComicsManifestFromGitHub()
  if (ghManifest && ghManifest.series.length > 0) {
    const mappedFromGh: ComicSeriesRecord[] = ghManifest.series.map((s) => ({
      id: s.id,
      slug: s.slug,
      folder: s.folder,
      title: s.title,
      sub: s.sub,
      synopsis: s.synopsis,
      author: s.author,
      origin: s.origin,
      status: s.status,
      genres: s.genres,
      rating: s.rating,
      views: s.views,
      followers: s.followers,
      tone: s.tone,
      latestChapter: s.latestChapter,
      badge: s.badge,
      updateDay: s.updateDay,
      coverUrl: s.githubCoverUrl || s.coverUrl,
      episodes: s.episodes.map((ep) => ({
        id: ep.id,
        dir: ep.dir,
        chapterNumber: ep.chapterNumber,
        title: ep.title,
        coinPrice: ep.coinPrice,
        isPreview: ep.isPreview,
        publishedAt: ep.publishedAt,
        pages: ep.githubPages?.length > 0 ? ep.githubPages : ep.pages,
      })),
    }))
    return { series: mappedFromGh, source: 'github-storage' }
  }

  return { series: STARTER_SERIES, source: 'firebase-seed' }
}
