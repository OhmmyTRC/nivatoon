import fs from 'node:fs'
import path from 'node:path'
import {
  cert,
  getApps as getAdminApps,
  initializeApp as initializeAdminApp,
  type App as AdminApp,
  type ServiceAccount,
} from 'firebase-admin/app'
import {
  getDatabase as getAdminDatabaseSdk,
  type Database as AdminRtdb,
} from 'firebase-admin/database'
import {
  getFirestore as getAdminFirestoreSdk,
  type Firestore as AdminFirestore,
} from 'firebase-admin/firestore'
import {
  type DbCommentRow,
  type DbCreatorRequestRow,
  type DbIssueReportRow,
  type DbNotificationRow,
  type DbUserRow,
  type DbWalletTxRow,
  getDb,
} from './app-db'
import {
  generateAndSaveComicsManifest,
  getGitHubStorageStatus,
  GITHUB_RAW_PUBLIC_BASE,
  GITHUB_REPO_FULL,
  toGitHubRawUrl,
} from './github-storage'

export const FIREBASE_DEFAULT_PROJECT_ID = 'niva-421c2'
export const FIREBASE_DEFAULT_RTDB_URL =
  'https://niva-421c2-default-rtdb.asia-southeast1.firebasedatabase.app'

let cachedAdminApp: AdminApp | null = null
let cachedAdminDb: AdminFirestore | null = null
let cachedAdminRtdb: AdminRtdb | null = null
let cachedAdminAttempted = false
let rtdbRulesEnsured = false

function readServiceAccountFromEnv(): ServiceAccount | null {
  const inlineOrPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()
  if (inlineOrPath) {
    try {
      const jsonText = inlineOrPath.startsWith('{')
        ? inlineOrPath
        : fs.readFileSync(path.resolve(inlineOrPath), 'utf8')
      const parsed = JSON.parse(jsonText) as ServiceAccount
      if (parsed.projectId || (parsed as Record<string, unknown>).project_id) {
        return parsed
      }
    } catch {
      return null
    }
  }

  const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (gacPath) {
    const resolvedGac = path.resolve(gacPath)
    if (fs.existsSync(resolvedGac)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(resolvedGac, 'utf8')) as ServiceAccount
        if (parsed.projectId || (parsed as Record<string, unknown>).project_id) {
          return parsed
        }
      } catch {
        return null
      }
    }
  }

  // Fallback: detect Firebase Admin SDK key file in project root
  try {
    const rootFiles = fs.readdirSync(/*turbopackIgnore: true*/ process.cwd())
    const sdkFile = rootFiles.find(
      (f) => f === 'serviceAccountKey.json' || /firebase-adminsdk.*\.json$/i.test(f),
    )
    if (sdkFile) {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), sdkFile), 'utf8'),
      ) as ServiceAccount
      if (parsed.projectId || (parsed as Record<string, unknown>).project_id) {
        return parsed
      }
    }
  } catch {
    // ignore fs read errors
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    FIREBASE_DEFAULT_PROJECT_ID
  if (clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey,
    }
  }

  return null
}

export function isFirebaseWebConfigured(): boolean {
  const apiKey = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const appId = process.env.FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  return Boolean(apiKey && appId && projectId)
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(readServiceAccountFromEnv())
}

export function isFirebaseConfigured(): boolean {
  return isFirebaseWebConfigured() || isFirebaseAdminConfigured()
}

export function getFirebaseStatus() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    FIREBASE_DEFAULT_PROJECT_ID
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    FIREBASE_DEFAULT_RTDB_URL
  return {
    projectId,
    databaseURL,
    webConfigured: isFirebaseWebConfigured(),
    analyticsConfigured: Boolean(
      process.env.FIREBASE_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    ),
    adminConnected: isFirebaseAdminConfigured(),
    githubStorage: getGitHubStorageStatus(),
  }
}

function getOrInitAdminApp(): AdminApp | null {
  if (cachedAdminApp) return cachedAdminApp
  if (cachedAdminAttempted) return null
  cachedAdminAttempted = true

  const serviceAccount = readServiceAccountFromEnv()
  if (!serviceAccount) return null

  try {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      serviceAccount.projectId ||
      (serviceAccount as unknown as { project_id?: string }).project_id ||
      FIREBASE_DEFAULT_PROJECT_ID
    const databaseURL =
      process.env.FIREBASE_DATABASE_URL ||
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
      FIREBASE_DEFAULT_RTDB_URL

    cachedAdminApp =
      getAdminApps().length > 0
        ? getAdminApps()[0]!
        : initializeAdminApp({
            credential: cert(serviceAccount),
            projectId,
            databaseURL,
          })

    return cachedAdminApp
  } catch {
    return null
  }
}

export function getAdminFirestore(): AdminFirestore | null {
  if (cachedAdminDb) return cachedAdminDb
  const app = getOrInitAdminApp()
  if (!app) return null
  try {
    cachedAdminDb = getAdminFirestoreSdk(app)
    return cachedAdminDb
  } catch {
    return null
  }
}

export function getAdminRtdb(): AdminRtdb | null {
  if (cachedAdminRtdb) return cachedAdminRtdb
  const app = getOrInitAdminApp()
  if (!app) return null
  try {
    cachedAdminRtdb = getAdminDatabaseSdk(app)
    return cachedAdminRtdb
  } catch {
    return null
  }
}

function toSafeRtdbKey(rawKey: string): string {
  return rawKey.trim().replace(/[.#$/[\]]/g, '_')
}

/**
 * Ensures Firebase Realtime Database rules permit structured access on `/nivatoon_cloud`
 * for the exported Android App (`nivatoon-release.apk`) and Web App while keeping root private.
 */
export async function ensureFirebaseRtdbCloudRules(): Promise<boolean> {
  if (rtdbRulesEnsured) return true
  const rtdb = getAdminRtdb()
  if (!rtdb) return false

  try {
    const rulesConfig = {
      rules: {
        '.read': false,
        '.write': false,
        nivatoon_cloud: {
          '.read': true,
          storage_config: {
            '.write': true,
          },
          series: {
            $slug: {
              '.write': "newData.hasChildren(['slug', 'title'])",
            },
          },
          series_stats: {
            $slug: {
              '.write': true,
            },
          },
          users: {
            $userId: {
              '.write': "!newData.exists() || newData.hasChildren(['id', 'email'])",
            },
          },
          creator_requests: {
            $reqId: {
              '.write': "!newData.exists() || newData.hasChildren(['id', 'penName', 'sampleTitle'])",
            },
          },
          wallet_transactions: {
            $txId: {
              '.write': "!newData.exists() || newData.hasChildren(['id', 'reference'])",
            },
          },
          comments: {
            $commentId: {
              '.write': "!newData.exists() || newData.hasChildren(['id', 'series_slug', 'body'])",
            },
          },
          issue_reports: {
            $issueId: {
              '.write': "!newData.exists() || newData.hasChildren(['id', 'subject'])",
            },
          },
          notifications: {
            $notifId: {
              '.write': "!newData.exists() || newData.hasChildren(['id', 'title'])",
            },
          },
          system_logs: {
            $logId: {
              '.write': true,
            },
          },
        },
      },
    }
    await rtdb.setRules(JSON.stringify(rulesConfig, null, 2))
    rtdbRulesEnsured = true
    return true
  } catch {
    return false
  }
}

/**
 * Mirrors server records to both Cloud Firestore (`niva-421c2`) AND Firebase Realtime Database
 * (`nivatoon_cloud/<collection>/<docId>`) so Web and Mobile App stay in real-time sync.
 */
export async function syncDocToFirebase(
  collectionName: string,
  docId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const firestore = getAdminFirestore()
  const rtdb = getAdminRtdb()
  if (!firestore && !rtdb) return false

  const timestamped = {
    ...payload,
    syncedAt: new Date().toISOString(),
  }

  let ok = false
  if (firestore) {
    try {
      await firestore.collection(collectionName).doc(docId).set(timestamped, { merge: true })
      ok = true
    } catch {
      // ignore if strict collection schema differs
    }
  }

  if (rtdb) {
    try {
      const safeKey = toSafeRtdbKey(docId)
      await rtdb.ref(`nivatoon_cloud/${collectionName}/${safeKey}`).update(timestamped)
      ok = true
    } catch {
      // ignore rtdb error
    }
  }

  return ok
}

export async function deleteDocFromFirebase(
  collectionName: string,
  docId: string,
): Promise<boolean> {
  const firestore = getAdminFirestore()
  const rtdb = getAdminRtdb()
  if (!firestore && !rtdb) return false

  let ok = false
  if (firestore) {
    try {
      await firestore.collection(collectionName).doc(docId).delete()
      ok = true
    } catch {}
  }

  if (rtdb) {
    try {
      const safeKey = toSafeRtdbKey(docId)
      await rtdb.ref(`nivatoon_cloud/${collectionName}/${safeKey}`).remove()
      ok = true
    } catch {}
  }

  return ok
}

/**
 * Full bi-directional synchronization:
 * 1. Builds `public/comics/manifest.json` with GitHub Raw URLs (`https://raw.githubusercontent.com/OhmmyTRC/nivatoon/main/public/...`)
 * 2. Pushes all series, users, creator_requests, wallet_transactions, comments, issue_reports,
 *    notifications, series_stats, and system_logs to Firebase Firestore & Realtime Database (`niva-421c2`).
 */
export async function syncFullDatabaseToFirebase(): Promise<{
  ok: boolean
  projectId: string
  githubRepo: string
  counts: Record<string, number>
  syncedAt: string
}> {
  const syncedAt = new Date().toISOString()
  await ensureFirebaseRtdbCloudRules()

  const { manifest } = generateAndSaveComicsManifest()
  const db = getDb()
  const firestore = getAdminFirestore()
  const rtdb = getAdminRtdb()

  const users = db.prepare('SELECT * FROM users').all() as unknown as DbUserRow[]
  const creatorRequests = db
    .prepare('SELECT * FROM creator_requests ORDER BY created_at DESC')
    .all() as unknown as DbCreatorRequestRow[]
  const transactions = db
    .prepare('SELECT * FROM wallet_transactions ORDER BY created_at DESC LIMIT 200')
    .all() as unknown as DbWalletTxRow[]
  const comments = db
    .prepare('SELECT * FROM comments ORDER BY created_at DESC LIMIT 200')
    .all() as unknown as DbCommentRow[]
  const issues = db
    .prepare('SELECT * FROM issue_reports ORDER BY created_at DESC LIMIT 100')
    .all() as unknown as DbIssueReportRow[]
  const notifications = db
    .prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50')
    .all() as unknown as DbNotificationRow[]
  const seriesStats = db.prepare('SELECT * FROM series_stats').all() as Array<{
    series_slug: string
    views_count: number
    likes_count: number
    unlocks_count: number
    rating_sum: number
    rating_count: number
  }>
  const libraryRows = db.prepare('SELECT * FROM library_items').all() as Array<{
    user_id: string
    series_slug: string
    notifications: number
  }>
  const unlockedRows = db.prepare('SELECT * FROM unlocked_chapters').all() as Array<{
    user_id: string
    chapter_id: string
    series_slug: string
    chapter_number: number
    coins_paid: number
    unlocked_at: string
  }>
  const historyRows = db.prepare('SELECT * FROM reading_history').all() as Array<{
    user_id: string
    series_slug: string
    chapter_number: number
    percent: number
    page: number
    updated_at: string
  }>

  const rtdbPayload: Record<string, Record<string, unknown>> = {
    storage_config: {
      provider: 'github',
      repository: GITHUB_REPO_FULL,
      rawBaseUrl: GITHUB_RAW_PUBLIC_BASE,
      manifestUrl: `${GITHUB_RAW_PUBLIC_BASE}/comics/manifest.json`,
      apkDownloadUrl: `${GITHUB_RAW_PUBLIC_BASE}/nivatoon-release.apk`,
      firebaseProjectId: FIREBASE_DEFAULT_PROJECT_ID,
      syncedAt,
    },
    series: {},
    series_stats: {},
    users: {},
    creator_requests: {},
    wallet_transactions: {},
    comments: {},
    issue_reports: {},
    notifications: {},
  }

  for (const s of manifest.series) {
    const stat = seriesStats.find((st) => st.series_slug === s.slug)
    const viewsCount = stat?.views_count ?? 180000
    const avgRating =
      stat && stat.rating_count > 0
        ? Number((stat.rating_sum / stat.rating_count).toFixed(2))
        : s.rating

    const seriesDoc = {
      slug: s.slug,
      folder: s.folder,
      title: s.title,
      sub: s.sub,
      author: s.author,
      origin: s.origin,
      status: s.status,
      genres: s.genres,
      synopsis: s.synopsis,
      updateDay: s.updateDay,
      rating: avgRating,
      viewsCount,
      coverUrl: s.coverUrl,
      githubCoverUrl: s.githubCoverUrl,
      episodesCount: s.episodes.length,
      episodes: s.episodes,
      updatedAt: syncedAt,
      syncedAt,
    }
    rtdbPayload.series[toSafeRtdbKey(s.slug)] = seriesDoc

    if (firestore) {
      try {
        await firestore
          .collection('series')
          .doc(s.slug)
          .set(
            {
              slug: s.slug,
              folder: s.folder,
              title: s.title,
              sub: s.sub,
              author: s.author,
              origin: s.origin,
              status: s.status,
              genres: s.genres.slice(0, 5),
              synopsis: s.synopsis.slice(0, 1500),
              updateDay: s.updateDay,
              cover: s.githubCoverUrl || s.coverUrl,
              episodesCount: s.episodes.length,
              updatedAt: syncedAt,
              syncedAt,
            },
            { merge: true },
          )
      } catch {}
    }
  }

  for (const st of seriesStats) {
    rtdbPayload.series_stats[toSafeRtdbKey(st.series_slug)] = {
      ...st,
      syncedAt,
    }
    if (firestore) {
      try {
        await firestore
          .collection('series_stats')
          .doc(st.series_slug)
          .set({ ...st, syncedAt }, { merge: true })
      } catch {}
    }
  }

  for (const u of users) {
    const userLib = libraryRows.filter((l) => l.user_id === u.id).map((l) => l.series_slug)
    const userUnlocks = unlockedRows.filter((ul) => ul.user_id === u.id)
    const userHistory = historyRows.filter((h) => h.user_id === u.id)

    const userDoc = {
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      avatarUrl: toGitHubRawUrl(u.avatar_url) || u.avatar_url,
      avatarFrame: u.avatar_frame,
      bio: u.bio,
      bannerTheme: u.banner_theme,
      role: u.role,
      creatorStatus: u.creator_status,
      coinBalance: u.coin_balance,
      freePassTickets: u.free_pass_tickets,
      plan: u.plan,
      streakDays: u.streak_days,
      checkinDay: u.checkin_day,
      lastCheckinDate: u.last_checkin_date,
      themeMode: u.theme_mode,
      librarySlugs: userLib,
      unlockedChapterIds: userUnlocks.map((ul) => ul.chapter_id),
      unlockedChapters: userUnlocks,
      readingHistory: userHistory,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
      syncedAt,
    }
    rtdbPayload.users[toSafeRtdbKey(u.id)] = userDoc

    if (firestore) {
      try {
        await firestore
          .collection('users')
          .doc(u.id)
          .set(
            {
              id: u.id,
              email: u.email,
              displayName: u.display_name,
              avatarUrl: toGitHubRawUrl(u.avatar_url) || u.avatar_url,
              avatarFrame: u.avatar_frame,
              bio: u.bio,
              bannerTheme: u.banner_theme,
              role: u.role,
              creatorStatus: u.creator_status,
              coinBalance: u.coin_balance,
              freePassTickets: u.free_pass_tickets,
              plan: u.plan,
              streakDays: u.streak_days,
              createdAt: u.created_at,
              updatedAt: u.updated_at,
              syncedAt,
            },
            { merge: true },
          )
      } catch {}
    }
  }

  for (const req of creatorRequests) {
    let samplePages: string[] = []
    if (req.sample_pages_json) {
      try {
        const parsed = JSON.parse(req.sample_pages_json)
        if (Array.isArray(parsed)) samplePages = parsed
      } catch {}
    }
    const githubSampleCover =
      toGitHubRawUrl(req.sample_cover_url) ||
      `${GITHUB_RAW_PUBLIC_BASE}/comics/06-rank-zero-hunter/cover.jpg`
    const githubSamplePages =
      samplePages.length > 0
        ? samplePages.map((p) => toGitHubRawUrl(p) || p)
        : [
            `${GITHUB_RAW_PUBLIC_BASE}/comics/06-rank-zero-hunter/ep-01/001.jpg`,
            `${GITHUB_RAW_PUBLIC_BASE}/comics/06-rank-zero-hunter/ep-01/002.jpg`,
          ]

    const reqDoc = {
      id: req.id,
      userId: req.user_id,
      email: req.email,
      displayName: req.display_name,
      penName: req.pen_name,
      sampleTitle: req.sample_title,
      portfolioNote: req.portfolio_note,
      sampleSynopsis: req.sample_synopsis || req.portfolio_note,
      sampleCoverUrl: githubSampleCover,
      samplePages: githubSamplePages,
      status: req.status,
      reviewedBy: req.reviewed_by,
      reviewNote: req.review_note,
      createdAt: req.created_at,
      updatedAt: req.updated_at,
      syncedAt,
    }
    rtdbPayload.creator_requests[toSafeRtdbKey(req.id)] = reqDoc

    if (firestore) {
      try {
        await firestore
          .collection('creator_requests')
          .doc(req.id)
          .set(
            {
              id: req.id,
              userId: req.user_id,
              email: req.email,
              displayName: req.display_name,
              penName: req.pen_name,
              sampleTitle: req.sample_title,
              portfolioNote: req.portfolio_note,
              status: req.status,
              ...(req.reviewed_by ? { reviewedBy: req.reviewed_by } : {}),
              ...(req.review_note ? { reviewNote: req.review_note } : {}),
              createdAt: req.created_at,
              updatedAt: req.updated_at,
              syncedAt,
            },
            { merge: true },
          )
      } catch {}
    }
  }

  for (const tx of transactions) {
    rtdbPayload.wallet_transactions[toSafeRtdbKey(tx.id)] = {
      ...tx,
      syncedAt,
    }
    if (firestore) {
      try {
        await firestore
          .collection('wallet_transactions')
          .doc(tx.id)
          .set({ ...tx, syncedAt }, { merge: true })
      } catch {}
    }
  }

  for (const c of comments) {
    rtdbPayload.comments[toSafeRtdbKey(c.id)] = {
      ...c,
      syncedAt,
    }
    if (firestore) {
      try {
        await firestore
          .collection('comments')
          .doc(c.id)
          .set({ ...c, syncedAt }, { merge: true })
      } catch {}
    }
  }

  for (const iss of issues) {
    rtdbPayload.issue_reports[toSafeRtdbKey(iss.id)] = {
      ...iss,
      syncedAt,
    }
    if (firestore) {
      try {
        await firestore
          .collection('issue_reports')
          .doc(iss.id)
          .set({ ...iss, syncedAt }, { merge: true })
      } catch {}
    }
  }

  for (const n of notifications) {
    rtdbPayload.notifications[toSafeRtdbKey(n.id)] = {
      ...n,
      syncedAt,
    }
    if (firestore) {
      try {
        await firestore
          .collection('notifications')
          .doc(n.id)
          .set({ ...n, syncedAt }, { merge: true })
      } catch {}
    }
  }

  if (rtdb) {
    try {
      await rtdb.ref('nivatoon_cloud').update(rtdbPayload)
    } catch {}
  }

  return {
    ok: Boolean(firestore || rtdb),
    projectId: FIREBASE_DEFAULT_PROJECT_ID,
    githubRepo: GITHUB_REPO_FULL,
    counts: {
      series: manifest.series.length,
      users: users.length,
      creatorRequests: creatorRequests.length,
      transactions: transactions.length,
      comments: comments.length,
      issues: issues.length,
      notifications: notifications.length,
    },
    syncedAt,
  }
}

/**
 * Pulls new or updated records created directly in Firebase (`nivatoon_cloud`)
 * (for example, from the exported Android App `nivatoon-release.apk`) back into the local SQLite database.
 */
export async function pullCloudStateFromFirebase(): Promise<{
  ok: boolean
  importedComments: number
  importedIssues: number
  importedRequests: number
  importedNotifications: number
  updatedUsers: number
}> {
  const rtdb = getAdminRtdb()
  if (!rtdb) {
    return {
      ok: false,
      importedComments: 0,
      importedIssues: 0,
      importedRequests: 0,
      importedNotifications: 0,
      updatedUsers: 0,
    }
  }

  try {
    const snap = await rtdb.ref('nivatoon_cloud').get()
    if (!snap.exists()) {
      await syncFullDatabaseToFirebase()
      return {
        ok: true,
        importedComments: 0,
        importedIssues: 0,
        importedRequests: 0,
        importedNotifications: 0,
        updatedUsers: 0,
      }
    }

    const cloud = snap.val() as Record<string, Record<string, any>>
    const db = getDb()
    const now = new Date().toISOString()

    let importedComments = 0
    let importedIssues = 0
    let importedRequests = 0
    let importedNotifications = 0
    let updatedUsers = 0

    // 1. Merge comments from Firebase
    if (cloud.comments) {
      const insertCmt = db.prepare(`
        INSERT OR IGNORE INTO comments (
          id, user_id, series_slug, chapter_number, author_name, author_avatar,
          author_badge, body, likes, is_top, is_spoiler, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const c of Object.values(cloud.comments)) {
        if (!c || !c.id || !c.series_slug || !c.body) continue
        const info = insertCmt.run(
          String(c.id),
          c.user_id ? String(c.user_id) : null,
          String(c.series_slug),
          Number(c.chapter_number || 1),
          String(c.author_name || 'นักอ่าน NIVATOON'),
          c.author_avatar ? String(c.author_avatar) : null,
          String(c.author_badge || 'READER'),
          String(c.body),
          Number(c.likes || 0),
          Number(c.is_top ? 1 : 0),
          Number(c.is_spoiler ? 1 : 0),
          String(c.created_at || now),
        )
        if (info.changes > 0) importedComments += 1
      }
    }

    // 2. Merge issue reports from Firebase
    if (cloud.issue_reports) {
      const upsertIssue = db.prepare(`
        INSERT INTO issue_reports (
          id, user_id, user_email, user_name, category, subject, description,
          page_url, status, admin_reply, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          admin_reply = COALESCE(excluded.admin_reply, issue_reports.admin_reply),
          updated_at = excluded.updated_at
      `)
      for (const iss of Object.values(cloud.issue_reports)) {
        if (!iss || !iss.id || !iss.subject) continue
        upsertIssue.run(
          String(iss.id),
          iss.user_id ? String(iss.user_id) : null,
          String(iss.user_email || iss.userEmail || 'user@nivatoon.app'),
          String(iss.user_name || iss.userName || 'ผู้ใช้งานแอป'),
          String(iss.category || 'mobile-apk'),
          String(iss.subject),
          String(iss.description || ''),
          iss.page_url ? String(iss.page_url) : null,
          String(iss.status || 'open'),
          iss.admin_reply || iss.adminReply ? String(iss.admin_reply || iss.adminReply) : null,
          String(iss.created_at || iss.createdAt || now),
          String(iss.updated_at || iss.updatedAt || now),
        )
        importedIssues += 1
      }
    }

    // 3. Merge creator requests from Firebase
    if (cloud.creator_requests) {
      const upsertReq = db.prepare(`
        INSERT INTO creator_requests (
          id, user_id, email, display_name, pen_name, sample_title, portfolio_note,
          sample_cover_url, sample_pages_json, sample_synopsis, status, reviewed_by,
          review_note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          reviewed_by = COALESCE(excluded.reviewed_by, creator_requests.reviewed_by),
          review_note = COALESCE(excluded.review_note, creator_requests.review_note),
          updated_at = excluded.updated_at
      `)
      for (const req of Object.values(cloud.creator_requests)) {
        if (!req || !req.id || !(req.penName || req.pen_name)) continue
        const pagesArr = Array.isArray(req.samplePages) ? req.samplePages : []
        upsertReq.run(
          String(req.id),
          String(req.userId || req.user_id || 'user-mobile'),
          String(req.email || req.userEmail || 'reader@gmail.com'),
          String(req.displayName || req.display_name || 'นักอ่าน NIVATOON'),
          String(req.penName || req.pen_name),
          String(req.sampleTitle || req.sample_title || 'ผลงานตัวอย่าง'),
          String(req.portfolioNote || req.portfolio_note || req.synopsis || ''),
          req.sampleCoverUrl || req.sample_cover_url || null,
          pagesArr.length > 0 ? JSON.stringify(pagesArr) : req.sample_pages_json || null,
          String(req.sampleSynopsis || req.sample_synopsis || req.synopsis || ''),
          String(req.status || 'pending'),
          req.reviewedBy || req.reviewed_by || null,
          req.reviewNote || req.review_note || null,
          String(req.createdAt || req.created_at || now),
          String(req.updatedAt || req.updated_at || now),
        )
        importedRequests += 1
      }
    }

    // 4. Merge notifications from Firebase
    if (cloud.notifications) {
      const insertNotif = db.prepare(`
        INSERT OR IGNORE INTO notifications (
          id, title, message, type, badge, cta_url, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const n of Object.values(cloud.notifications)) {
        if (!n || !n.id || !n.title) continue
        const info = insertNotif.run(
          String(n.id),
          String(n.title),
          String(n.message || ''),
          String(n.type || 'promo'),
          String(n.badge || 'PROMO'),
          n.cta_url ? String(n.cta_url) : '/wallet/topup',
          Number(n.is_active ?? 1),
          String(n.created_at || n.createdAt || now),
        )
        if (info.changes > 0) importedNotifications += 1
      }
    }

    // 5. Merge user balances / tickets / roles updated from mobile app in Firebase
    if (cloud.users) {
      const updateExistingUser = db.prepare(`
        UPDATE users SET
          display_name = COALESCE(?, display_name),
          bio = COALESCE(?, bio),
          role = COALESCE(?, role),
          creator_status = COALESCE(?, creator_status),
          coin_balance = CASE WHEN ? > coin_balance THEN ? ELSE coin_balance END,
          free_pass_tickets = COALESCE(?, free_pass_tickets),
          plan = CASE WHEN ? = 'plus' THEN 'plus' ELSE plan END,
          checkin_day = CASE WHEN ? > checkin_day THEN ? ELSE checkin_day END,
          last_checkin_date = CASE WHEN ? != '' THEN ? ELSE last_checkin_date END
        WHERE lower(email) = lower(?)
      `)
      for (const u of Object.values(cloud.users)) {
        if (!u || !u.email) continue
        const coins = Number(u.coinBalance ?? u.coin_balance ?? 0)
        const tickets = Number(u.freePassTickets ?? u.free_pass_tickets ?? 3)
        const chkDay = Number(u.checkinDay ?? u.checkin_day ?? 0)
        const lastChk = String(u.lastCheckinDate ?? u.last_checkin_date ?? '')
        const info = updateExistingUser.run(
          u.displayName || u.display_name || null,
          typeof u.bio === 'string' ? u.bio : null,
          u.role || null,
          u.creatorStatus || u.creator_status || null,
          coins,
          coins,
          tickets,
          u.plan || 'free',
          chkDay,
          chkDay,
          lastChk,
          lastChk,
          String(u.email),
        )
        if (info.changes > 0) updatedUsers += 1
      }
    }

    return {
      ok: true,
      importedComments,
      importedIssues,
      importedRequests,
      importedNotifications,
      updatedUsers,
    }
  } catch {
    return {
      ok: false,
      importedComments: 0,
      importedIssues: 0,
      importedRequests: 0,
      importedNotifications: 0,
      updatedUsers: 0,
    }
  }
}
