import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getSystemSetting } from './app-db'
import { type ComicFolderSeries, scanComicsDirectory } from './comics-fs'

const execFileAsync = promisify(execFile)

export const GITHUB_OWNER = process.env.GITHUB_OWNER || 'OhmmyTRC'
export const GITHUB_REPO = process.env.GITHUB_REPO || 'nivatoon'
export const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'

export const GITHUB_REPO_FULL = `${GITHUB_OWNER}/${GITHUB_REPO}`
export const GITHUB_REPO_WEB_URL = `https://github.com/${GITHUB_REPO_FULL}`
export const GITHUB_RAW_PUBLIC_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/public`
export const GITHUB_CDN_PUBLIC_BASE = `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@${GITHUB_BRANCH}/public`

export interface GitHubManifestEpisode {
  id: string
  dir: string
  chapterNumber: number
  title: string
  coinPrice: number
  isPreview: boolean
  publishedAt: string
  pages: string[]
  githubPages: string[]
}

export interface GitHubManifestSeries {
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
  githubCoverUrl: string | null
  episodes: GitHubManifestEpisode[]
}

export interface GitHubComicsManifest {
  version: string
  repository: string
  branch: string
  rawBaseUrl: string
  cdnBaseUrl: string
  updatedAt: string
  seriesCount: number
  totalEpisodes: number
  totalPages: number
  series: GitHubManifestSeries[]
}

function safeDecodeSegment(seg: string): string {
  try {
    return decodeURIComponent(seg)
  } catch {
    return seg
  }
}

/**
 * Converts a local public path (e.g. `/comics/01-moonlit-sword/cover.jpg`)
 * into a permanent GitHub Raw URL (`https://raw.githubusercontent.com/OhmmyTRC/nivatoon/main/public/comics/...`).
 */
export function toGitHubRawUrl(publicUrlPath: string | null | undefined): string | null {
  if (!publicUrlPath) return null
  const trimmed = publicUrlPath.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed
  }
  const cleanRel = trimmed.split('?')[0].replace(/^\/+/, '').replace(/^public\/+/, '')
  const encodedSegments = cleanRel
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(safeDecodeSegment(seg)))
  return `${GITHUB_RAW_PUBLIC_BASE}/${encodedSegments.join('/')}`
}

/**
 * Converts a local public path into a jsDelivr GitHub CDN URL.
 */
export function toGitHubCdnUrl(publicUrlPath: string | null | undefined): string | null {
  if (!publicUrlPath) return null
  const trimmed = publicUrlPath.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed
  }
  const cleanRel = trimmed.split('?')[0].replace(/^\/+/, '').replace(/^public\/+/, '')
  const encodedSegments = cleanRel
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(safeDecodeSegment(seg)))
  return `${GITHUB_CDN_PUBLIC_BASE}/${encodedSegments.join('/')}`
}

export function buildComicsManifestFromDisk(
  seriesList?: ComicFolderSeries[],
): GitHubComicsManifest {
  const scanned = seriesList ?? scanComicsDirectory()
  let totalEpisodes = 0
  let totalPages = 0

  const mappedSeries: GitHubManifestSeries[] = scanned.map((s) => {
    const episodes: GitHubManifestEpisode[] = s.episodes.map((ep) => {
      totalEpisodes += 1
      totalPages += ep.pages.length
      return {
        id: ep.id,
        dir: ep.dir,
        chapterNumber: ep.chapterNumber,
        title: ep.title,
        coinPrice: ep.coinPrice,
        isPreview: ep.isPreview,
        publishedAt: ep.publishedAt,
        pages: ep.pages,
        githubPages: ep.pages.map((p) => toGitHubRawUrl(p) ?? p),
      }
    })

    return {
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
      coverUrl: s.coverUrl,
      githubCoverUrl: toGitHubRawUrl(s.coverUrl),
      episodes,
    }
  })

  return {
    version: '2026-11-github-storage-v1',
    repository: GITHUB_REPO_FULL,
    branch: GITHUB_BRANCH,
    rawBaseUrl: GITHUB_RAW_PUBLIC_BASE,
    cdnBaseUrl: GITHUB_CDN_PUBLIC_BASE,
    updatedAt: new Date().toISOString(),
    seriesCount: mappedSeries.length,
    totalEpisodes,
    totalPages,
    series: mappedSeries,
  }
}

export function generateAndSaveComicsManifest(): {
  manifestPath: string
  manifest: GitHubComicsManifest
} {
  const manifest = buildComicsManifestFromDisk()
  const comicsDir = path.join(process.cwd(), 'public', 'comics')
  fs.mkdirSync(comicsDir, { recursive: true })
  const manifestPath = path.join(comicsDir, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  return { manifestPath, manifest }
}

function getActiveGitHubToken(): string | null {
  const dbToken = getSystemSetting('github_token')
  const envToken = process.env.GITHUB_TOKEN?.trim() || null
  return dbToken || envToken
}

/**
 * Uploads a single file buffer directly to GitHub via the GitHub Contents REST API
 * when `GITHUB_TOKEN` (or `github_token` in Admin Settings) is configured.
 */
export async function uploadBufferToGitHubApi(
  repoRelativePath: string,
  buffer: Buffer,
  commitMessage: string,
): Promise<{ ok: boolean; rawUrl: string; error?: string }> {
  const cleanPath = repoRelativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${cleanPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')}`

  const token = getActiveGitHubToken()
  if (!token) {
    return { ok: false, rawUrl, error: 'NO_GITHUB_TOKEN' }
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${cleanPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')}`

  try {
    let existingSha: string | undefined
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (getRes.ok) {
      const json = (await getRes.json()) as { sha?: string }
      existingSha = json.sha
    }

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        message: commitMessage,
        content: buffer.toString('base64'),
        branch: GITHUB_BRANCH,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    })

    if (!putRes.ok) {
      const errText = await putRes.text()
      return { ok: false, rawUrl, error: `GitHub API ${putRes.status}: ${errText.slice(0, 200)}` }
    }
    return { ok: true, rawUrl }
  } catch (err: any) {
    return { ok: false, rawUrl, error: err?.message || String(err) }
  }
}

/**
 * Commits and pushes specified repository-relative paths to `origin main` using the local Git CLI.
 */
export async function pushPathsViaGitCli(
  repoRelativePaths: string[],
  commitMessage: string,
): Promise<{ ok: boolean; output?: string; error?: string }> {
  try {
    const cwd = process.cwd()
    if (!fs.existsSync(path.join(cwd, '.git'))) {
      return { ok: false, error: 'NOT_A_GIT_WORKSPACE' }
    }

    const validPaths = repoRelativePaths
      .map((p) => p.replace(/\\/g, '/').replace(/^\/+/, ''))
      .filter(Boolean)

    if (validPaths.length === 0) {
      return { ok: false, error: 'NO_PATHS' }
    }

    await execFileAsync('git', ['add', '--', ...validPaths], { cwd })

    const { stdout: statusOut } = await execFileAsync(
      'git',
      ['status', '--porcelain', '--', ...validPaths],
      { cwd },
    )
    if (!statusOut.trim()) {
      return { ok: true, output: 'Already up to date in Git' }
    }

    await execFileAsync('git', ['commit', '-m', commitMessage], { cwd })
    const { stdout: pushOut, stderr: pushErr } = await execFileAsync(
      'git',
      ['push', 'origin', GITHUB_BRANCH],
      { cwd, timeout: 45000 },
    )
    return { ok: true, output: `${pushOut}\n${pushErr}`.trim() }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}

/**
 * High-level helper: syncs one or more files under `public/` to GitHub (`OhmmyTRC/nivatoon`),
 * trying the GitHub Contents API first (if `GITHUB_TOKEN` is set) and falling back to Git CLI push.
 */
export async function syncPublicFilesToGitHub(params: {
  repoRelativePaths: string[]
  commitMessage: string
  regenerateManifest?: boolean
}): Promise<{
  ok: boolean
  method: 'github-api' | 'git-cli' | 'local-only'
  rawUrls: string[]
  detail?: string
}> {
  const pathsToSync = [...params.repoRelativePaths]
  if (params.regenerateManifest) {
    generateAndSaveComicsManifest()
    if (!pathsToSync.includes('public/comics/manifest.json')) {
      pathsToSync.push('public/comics/manifest.json')
    }
  }

  const rawUrls = pathsToSync.map((p) => {
    const relFromPublic = p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^public\/+/, '')
    return toGitHubRawUrl(`/${relFromPublic}`) ?? p
  })

  const token = getActiveGitHubToken()
  if (token) {
    let allOk = true
    let lastErr = ''
    for (const relPath of pathsToSync) {
      const absPath = path.join(/*turbopackIgnore: true*/ process.cwd(), relPath)
      if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) continue
      const buf = fs.readFileSync(absPath)
      const res = await uploadBufferToGitHubApi(relPath, buf, params.commitMessage)
      if (!res.ok) {
        allOk = false
        lastErr = res.error || 'GitHub API error'
      }
    }
    if (allOk) {
      return { ok: true, method: 'github-api', rawUrls }
    }
    // Fall through to Git CLI if API token failed
    const cliFallback = await pushPathsViaGitCli(pathsToSync, params.commitMessage)
    if (cliFallback.ok) {
      return { ok: true, method: 'git-cli', rawUrls, detail: cliFallback.output }
    }
    return { ok: false, method: 'local-only', rawUrls, detail: lastErr || cliFallback.error }
  }

  const cliRes = await pushPathsViaGitCli(pathsToSync, params.commitMessage)
  if (cliRes.ok) {
    return { ok: true, method: 'git-cli', rawUrls, detail: cliRes.output }
  }
  return { ok: false, method: 'local-only', rawUrls, detail: cliRes.error }
}

/**
 * Fetches `manifest.json` from GitHub Raw CDN (`https://raw.githubusercontent.com/OhmmyTRC/nivatoon/main/public/comics/manifest.json`)
 * so serverless deployments or mobile clients can load the full comic catalog directly from GitHub.
 */
export async function fetchComicsManifestFromGitHub(): Promise<GitHubComicsManifest | null> {
  try {
    const url = `${GITHUB_RAW_PUBLIC_BASE}/comics/manifest.json?t=${Date.now()}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as GitHubComicsManifest
    if (data && Array.isArray(data.series)) {
      return data
    }
    return null
  } catch {
    return null
  }
}

export function getGitHubStorageStatus() {
  const token = getActiveGitHubToken()
  const hasGitDir = fs.existsSync(path.join(process.cwd(), '.git'))
  const manifestFile = path.join(process.cwd(), 'public', 'comics', 'manifest.json')
  let seriesCount = 0
  let totalPages = 0
  let updatedAt: string | null = null

  if (fs.existsSync(manifestFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as GitHubComicsManifest
      seriesCount = parsed.seriesCount ?? parsed.series?.length ?? 0
      totalPages = parsed.totalPages ?? 0
      updatedAt = parsed.updatedAt ?? null
    } catch {}
  } else {
    const built = buildComicsManifestFromDisk()
    seriesCount = built.seriesCount
    totalPages = built.totalPages
  }

  return {
    provider: 'github',
    repository: GITHUB_REPO_FULL,
    branch: GITHUB_BRANCH,
    repoUrl: GITHUB_REPO_WEB_URL,
    rawBaseUrl: GITHUB_RAW_PUBLIC_BASE,
    cdnBaseUrl: GITHUB_CDN_PUBLIC_BASE,
    manifestUrl: `${GITHUB_RAW_PUBLIC_BASE}/comics/manifest.json`,
    apkDownloadUrl: `${GITHUB_RAW_PUBLIC_BASE}/nivatoon-release.apk`,
    hasApiToken: Boolean(token),
    hasLocalGitPush: hasGitDir,
    seriesCount,
    totalPages,
    updatedAt,
  }
}
