import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'nivatoon.db')

let dbInstance: DatabaseSync | null = null

export type UserRole = 'user' | 'creator' | 'admin'
export type CreatorStatus = 'none' | 'pending' | 'approved' | 'rejected'

export interface DbUserRow {
  id: string
  email: string
  password_hash: string | null
  provider: string
  provider_account_id: string | null
  role: UserRole
  creator_status: CreatorStatus
  display_name: string
  avatar_url: string | null
  avatar_frame: string
  bio: string
  banner_theme: string
  coin_balance: number
  free_pass_tickets: number
  plan: 'free' | 'plus'
  streak_days: number
  checkin_day: number
  last_checkin_date: string
  theme_mode: 'light' | 'dark'
  pin_hash: string | null
  biometric_credential_id: string | null
  biometric_label: string | null
  created_at: string
  updated_at: string
}

export interface DbCreatorRequestRow {
  id: string
  user_id: string
  email: string
  display_name: string
  pen_name: string
  sample_title: string
  portfolio_note: string
  sample_cover_url: string | null
  sample_pages_json: string | null
  sample_synopsis: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  review_note: string | null
  created_at: string
  updated_at: string
}

export interface DbWalletTxRow {
  id: string
  reference: string
  user_id: string
  provider: string
  recipient_id: string
  type: string
  coins: number
  amount_thb: number
  status: string
  slip_url: string | null
  slip_hash: string | null
  verification_note: string | null
  created_at: string
}

export interface DbSystemLogRow {
  id: string
  level: string
  category: string
  message: string
  actor_email: string | null
  meta_json: string | null
  created_at: string
}

export interface DbIssueReportRow {
  id: string
  user_id: string | null
  user_email: string
  user_name: string
  category: string
  subject: string
  description: string
  page_url: string | null
  status: 'open' | 'investigating' | 'resolved'
  admin_reply: string | null
  created_at: string
  updated_at: string
}

export interface DbNotificationRow {
  id: string
  title: string
  message: string
  type: 'promo' | 'announcement' | 'update'
  badge: string
  cta_url: string | null
  is_active: number
  created_at: string
}

export interface DbCommentRow {
  id: string
  user_id: string | null
  series_slug: string
  chapter_number: number
  author_name: string
  author_avatar: string | null
  author_badge: string
  body: string
  likes: number
  is_top: number
  is_spoiler: number
  created_at: string
}

function hashSeedPassword(raw: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(raw, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance

  fs.mkdirSync(DATA_DIR, { recursive: true })
  const db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      provider TEXT NOT NULL DEFAULT 'email',
      provider_account_id TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      creator_status TEXT NOT NULL DEFAULT 'none',
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      avatar_frame TEXT NOT NULL DEFAULT 'emerald',
      bio TEXT NOT NULL DEFAULT '',
      banner_theme TEXT NOT NULL DEFAULT 'midnight',
      coin_balance INTEGER NOT NULL DEFAULT 0,
      free_pass_tickets INTEGER NOT NULL DEFAULT 3,
      plan TEXT NOT NULL DEFAULT 'free',
      streak_days INTEGER NOT NULL DEFAULT 1,
      checkin_day INTEGER NOT NULL DEFAULT 0,
      last_checkin_date TEXT NOT NULL DEFAULT '',
      theme_mode TEXT NOT NULL DEFAULT 'light',
      pin_hash TEXT,
      biometric_credential_id TEXT,
      biometric_label TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS creator_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      pen_name TEXT NOT NULL,
      sample_title TEXT NOT NULL,
      portfolio_note TEXT NOT NULL,
      sample_cover_url TEXT,
      sample_pages_json TEXT,
      sample_synopsis TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      review_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      recipient_id TEXT NOT NULL DEFAULT '1709700341765',
      type TEXT NOT NULL,
      coins INTEGER NOT NULL,
      amount_thb REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      slip_url TEXT,
      slip_hash TEXT,
      verification_note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL DEFAULT 'info',
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      actor_email TEXT,
      meta_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issue_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      page_url TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      admin_reply TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'promo',
      badge TEXT NOT NULL DEFAULT 'PROMO',
      cta_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_reads (
      user_id TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      read_at TEXT NOT NULL,
      PRIMARY KEY (user_id, notification_id)
    );

    CREATE TABLE IF NOT EXISTS series_stats (
      series_slug TEXT PRIMARY KEY,
      views_count INTEGER NOT NULL DEFAULT 0,
      likes_count INTEGER NOT NULL DEFAULT 0,
      unlocks_count INTEGER NOT NULL DEFAULT 0,
      rating_sum REAL NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      series_slug TEXT NOT NULL,
      chapter_number INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      author_avatar TEXT,
      author_badge TEXT NOT NULL DEFAULT 'READER',
      body TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      is_top INTEGER NOT NULL DEFAULT 0,
      is_spoiler INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS library_items (
      user_id TEXT NOT NULL,
      series_slug TEXT NOT NULL,
      notifications INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, series_slug)
    );

    CREATE TABLE IF NOT EXISTS unlocked_chapters (
      user_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      series_slug TEXT NOT NULL,
      chapter_number INTEGER NOT NULL,
      coins_paid INTEGER NOT NULL DEFAULT 0,
      unlocked_at TEXT NOT NULL,
      PRIMARY KEY (user_id, chapter_id)
    );

    CREATE TABLE IF NOT EXISTS reading_history (
      user_id TEXT NOT NULL,
      series_slug TEXT NOT NULL,
      chapter_number INTEGER NOT NULL,
      percent INTEGER NOT NULL DEFAULT 0,
      page INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, series_slug)
    );
  `)

  // Safe schema upgrade if DB existed from earlier step
  const cols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>
  const colNames = new Set(cols.map((c) => c.name))
  if (!colNames.has('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';")
  }
  if (!colNames.has('creator_status')) {
    db.exec("ALTER TABLE users ADD COLUMN creator_status TEXT NOT NULL DEFAULT 'none';")
  }
  if (!colNames.has('checkin_day')) {
    db.exec('ALTER TABLE users ADD COLUMN checkin_day INTEGER NOT NULL DEFAULT 0;')
  }
  if (!colNames.has('theme_mode')) {
    db.exec("ALTER TABLE users ADD COLUMN theme_mode TEXT NOT NULL DEFAULT 'light';")
  }

  const reqCols = db.prepare('PRAGMA table_info(creator_requests)').all() as Array<{ name: string }>
  const reqColNames = new Set(reqCols.map((c) => c.name))
  if (!reqColNames.has('sample_cover_url')) {
    db.exec('ALTER TABLE creator_requests ADD COLUMN sample_cover_url TEXT;')
  }
  if (!reqColNames.has('sample_pages_json')) {
    db.exec('ALTER TABLE creator_requests ADD COLUMN sample_pages_json TEXT;')
  }
  if (!reqColNames.has('sample_synopsis')) {
    db.exec('ALTER TABLE creator_requests ADD COLUMN sample_synopsis TEXT;')
  }

  const txCols = db.prepare('PRAGMA table_info(wallet_transactions)').all() as Array<{ name: string }>
  const txColNames = new Set(txCols.map((c) => c.name))
  if (!txColNames.has('slip_hash')) {
    db.exec('ALTER TABLE wallet_transactions ADD COLUMN slip_hash TEXT;')
  }

  seedInitialDb(db)
  dbInstance = db
  return db
}

function seedInitialDb(db: DatabaseSync) {
  const now = new Date().toISOString()
  const existingAdmin = db
    .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    .get() as { id: string } | undefined

  if (!existingAdmin) {
    const adminPass = hashSeedPassword('NivaAdmin2026!')
    db.prepare(`
      INSERT OR IGNORE INTO users (
        id, email, password_hash, provider, role, creator_status, display_name,
        avatar_frame, bio, banner_theme, coin_balance, free_pass_tickets, plan,
        streak_days, created_at, updated_at
      ) VALUES (?, ?, ?, 'email', 'admin', 'approved', ?, 'gold', ?, 'midnight', 9999, 99, 'plus', 30, ?, ?)
    `).run(
      'user-admin',
      'admin@nivatoon.app',
      adminPass,
      'แอดมินระบบ NIVATOON',
      'ผู้ดูแลระบบและอนุมัติสิทธิ์ครีเอเตอร์',
      now,
      now,
    )
  }

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      id, email, password_hash, provider, role, creator_status, display_name, avatar_frame,
      bio, banner_theme, coin_balance, free_pass_tickets, plan, streak_days,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const ensureAccount = (u: {
    id: string
    email: string
    password: string
    role: UserRole
    creator_status: CreatorStatus
    display_name: string
    avatar_frame: string
    bio: string
    banner_theme: string
    coin_balance: number
    free_pass_tickets: number
    plan: 'free' | 'plus'
    streak_days: number
  }) => {
    const exists = db.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').get(u.email)
    if (!exists) {
      insertUser.run(
        u.id,
        u.email,
        hashSeedPassword(u.password),
        u.role,
        u.creator_status,
        u.display_name,
        u.avatar_frame,
        u.bio,
        u.banner_theme,
        u.coin_balance,
        u.free_pass_tickets,
        u.plan,
        u.streak_days,
        now,
        now,
      )
    }
  }

  ensureAccount({
    id: 'user-creator-hana',
    email: 'creator@nivatoon.app',
    password: 'Creator2026!',
    role: 'creator',
    creator_status: 'approved',
    display_name: 'HANA STUDIO (ครีเอเตอร์)',
    avatar_frame: 'neon',
    bio: 'นักวาดมังฮวาออริจินัลเรื่อง ดาบจันทราเหนือมหานคร',
    banner_theme: 'emerald',
    coin_balance: 1450,
    free_pass_tickets: 5,
    plan: 'plus',
    streak_days: 14,
  })

  ensureAccount({
    id: 'user-reader-demo',
    email: 'reader@gmail.com',
    password: 'Reader2026!',
    role: 'user',
    creator_status: 'pending',
    display_name: 'เคนจิ นักอ่านสายแอ็กชัน',
    avatar_frame: 'emerald',
    bio: 'ชอบแนวระบบเทพ ดันเจี้ยน และกำลังขอสิทธิ์ลงผลงาน',
    banner_theme: 'amber',
    coin_balance: 890,
    free_pass_tickets: 3,
    plan: 'free',
    streak_days: 9,
  })

  // Ensure 1 pending creator request exists for Admin to review
  const hasSeedReq = db.prepare("SELECT id FROM creator_requests WHERE id = 'creq-seed-1' LIMIT 1").get()
  const readerRow = db.prepare("SELECT id FROM users WHERE email = 'reader@gmail.com' LIMIT 1").get() as
    | { id: string }
    | undefined
  if (!hasSeedReq && readerRow) {
    db.prepare(`
      INSERT OR IGNORE INTO creator_requests (
        id, user_id, email, display_name, pen_name, sample_title, portfolio_note, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      'creq-seed-1',
      readerRow.id,
      'reader@gmail.com',
      'เคนจิ นักอ่านสายแอ็กชัน',
      'KENJI INK STUDIO',
      'ดาบมังกรข้ามมิติ (Dragon Dimension)',
      'มีต้นฉบับมังฮวาแนวแอ็กชันแฟนตาซีวาดไว้ 5 ตอน พร้อมลงรายสัปดาห์ทุกวันศุกร์ครับ',
      now,
      now,
    )
  }

  const existingTx = db.prepare('SELECT COUNT(*) as cnt FROM wallet_transactions').get() as { cnt: number }
  if (existingTx.cnt === 0) {
    ensureAccount({
      id: 'user-meilin',
      email: 'meilin.lotus@gmail.com',
      password: 'Reader2026!',
      role: 'user',
      creator_status: 'none',
      display_name: 'เหมยหลิน โรแฟน',
      avatar_frame: 'rose',
      bio: 'แฟนคลับแนวย้อนยุคและวังหลวง',
      banner_theme: 'rose',
      coin_balance: 620,
      free_pass_tickets: 4,
      plan: 'free',
      streak_days: 6,
    })

    const insertTx = db.prepare(`
      INSERT OR IGNORE INTO wallet_transactions (
        id, reference, user_id, provider, recipient_id, type, coins, amount_thb, status, verification_note, created_at
      ) VALUES (?, ?, ?, ?, '1709700341765', 'topup', ?, ?, 'completed', ?, ?)
    `)
    insertTx.run('tx-seed-1', 'PP-20261121-001', 'user-creator-hana', 'promptpay', 6000, 1290, 'ยืนยันยอดโอนพร้อมเพย์อัตโนมัติ', now)
    insertTx.run('tx-seed-2', 'TM-20261121-002', 'user-creator-hana', 'truemoney', 2600, 599, 'ยืนยันสลิปทรูมันนี่สำเร็จ', now)
    insertTx.run('tx-seed-3', 'PP-20261121-003', 'user-reader-demo', 'promptpay', 2600, 599, 'ยืนยันยอดโอนพร้อมเพย์อัตโนมัติ', now)
    insertTx.run('tx-seed-4', 'TM-20261121-004', 'user-meilin', 'truemoney', 1200, 299, 'ยืนยันทรูมันนี่วอลเล็ทสำเร็จ', now)
  }

  const existingStats = db.prepare('SELECT COUNT(*) as cnt FROM series_stats').get() as { cnt: number }
  if (existingStats.cnt === 0) {
    const seedStats = [
      ['unrivaled-system', 247000, 19400, 3420, 49.0, 10],
      ['duchess-contract', 215000, 17800, 2910, 49.0, 10],
      ['moonlit-sword', 184000, 16200, 2740, 49.0, 10],
      ['shadow-apothecary', 169000, 14100, 2120, 48.0, 10],
      ['rank-zero-hunter', 156000, 13400, 1980, 47.0, 10],
      ['eclipse-academy', 142000, 11800, 1650, 48.0, 10],
      ['neon-shinjuku-99', 134000, 10900, 1540, 49.0, 10],
      ['palace-bloom', 121000, 10100, 1420, 48.0, 10],
      ['letter-from-tomorrow', 113000, 9800, 1210, 48.0, 10],
      ['reborn-as-demon', 98000, 8400, 980, 47.0, 10],
      ['Absolute-Regression-หวนคืนนิรันดร์กาล', 192000, 15900, 2600, 49.5, 10],
    ] as const

    const insStat = db.prepare(`
      INSERT OR IGNORE INTO series_stats (series_slug, views_count, likes_count, unlocks_count, rating_sum, rating_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const s of seedStats) {
      insStat.run(...s)
    }
  }

  const existingComments = db.prepare('SELECT COUNT(*) as cnt FROM comments').get() as { cnt: number }
  if (existingComments.cnt === 0) {
    const insComment = db.prepare(`
      INSERT INTO comments (id, user_id, series_slug, chapter_number, author_name, author_badge, body, likes, is_top, is_spoiler, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    insComment.run(
      'c-seed-1',
      'user-nicha',
      'moonlit-sword',
      1,
      'HANA STUDIO (ครีเอเตอร์)',
      'CREATOR',
      'ขอบคุณทุกคนที่ติดตามนะครับ ตอนใหม่ลงทุกวันศุกร์เหมือนเดิม!',
      1420,
      1,
      0,
      now,
    )
    insComment.run(
      'c-seed-2',
      'user-kenji',
      'Absolute-Regression-หวนคืนนิรันดร์กาล',
      1,
      'เคนจิ นักอ่านสายแอ็กชัน',
      'TOP',
      'ตอนที่ 1 เปิดเรื่องมาดีมาก ลายเส้นคมกริบ! แนะนำเปิดโหมด Auto-Scroll 1.5x ครับ',
      980,
      1,
      0,
      now,
    )
    insComment.run(
      'c-seed-3',
      'user-meilin',
      'moonlit-sword',
      1,
      'เหมยหลิน โรแฟน',
      'READER',
      'สปอยล์: จริงๆ แล้วหัวหน้าหน่วยศูนย์เคยรู้จักยูนาในอดีตก่อนถูกผนึกความทรงจำในตอนที่ 3',
      45,
      0,
      1,
      now,
    )
  }

  const existingNotifs = db.prepare('SELECT COUNT(*) as cnt FROM notifications').get() as { cnt: number }
  if (existingNotifs.cnt === 0) {
    const insNotif = db.prepare(`
      INSERT OR IGNORE INTO notifications (id, title, message, type, badge, cta_url, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `)
    insNotif.run(
      'notif-seed-1',
      'เช็กอิน 7 วัน รับตั๋วอ่านฟรีรวม 9 ใบ!',
      'เช็กอินวันที่ 1–6 รับวันละ 1 ตั๋ว พิเศษวันที่ 7 รับ 3 ตั๋วอ่านฟรีทันที',
      'promo',
      'EVENT',
      '/profile',
      now,
    )
    insNotif.run(
      'notif-seed-2',
      'แพ็กเกจ NIVATOON PLUS ฿129 (+300 เหรียญ)',
      'อ่านตอนล่วงหน้าฟรีทุกเรื่องพร้อมโบนัส 300 เหรียญ ชำระผ่าน PromptPay หรือ TrueMoney',
      'promo',
      'PROMO',
      '/plans',
      now,
    )
  }

  const existingLogs = db.prepare('SELECT COUNT(*) as cnt FROM system_logs').get() as { cnt: number }
  if (existingLogs.cnt === 0) {
    db.prepare(`
      INSERT INTO system_logs (id, level, category, message, actor_email, meta_json, created_at)
      VALUES (?, 'info', 'system', ?, 'system@nivatoon.app', ?, ?)
    `).run(
      `log-${crypto.randomUUID()}`,
      'NIVATOON Database & Admin Rule Engine initialized cleanly',
      JSON.stringify({ initialCoins: 0, initialFreeTickets: 3 }),
      now,
    )
  }
}

export function findUserByEmail(email: string): DbUserRow | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1')
    .get(email.trim()) as DbUserRow | undefined
  return row ?? null
}

export function findUserById(userId: string): DbUserRow | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
    .get(userId) as DbUserRow | undefined
  return row ?? null
}

export function createDbUser(params: {
  email: string
  passwordHash?: string | null
  role?: UserRole
  displayName: string
  avatarUrl?: string | null
}): DbUserRow {
  const db = getDb()
  const id = `user-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO users (
      id, email, password_hash, provider, role, creator_status, display_name,
      avatar_url, avatar_frame, bio, banner_theme, coin_balance, free_pass_tickets,
      plan, streak_days, checkin_day, last_checkin_date, theme_mode, created_at, updated_at
    ) VALUES (?, ?, ?, 'email', ?, 'none', ?, ?, 'emerald', '', 'midnight', 0, 3, 'free', 0, 0, '', 'light', ?, ?)
  `).run(
    id,
    params.email.trim().toLowerCase(),
    params.passwordHash ?? null,
    params.role ?? 'user',
    params.displayName.trim() || params.email.split('@')[0],
    params.avatarUrl ?? null,
    now,
    now,
  )

  return findUserById(id)!
}

export function getUserDashboardBundle(userId: string) {
  const db = getDb()
  const user = findUserById(userId)
  if (!user) return null

  const librarySlugs = (
    db.prepare('SELECT series_slug FROM library_items WHERE user_id = ?').all(userId) as Array<{
      series_slug: string
    }>
  ).map((r) => r.series_slug)

  const unlockedChapters = db
    .prepare(
      'SELECT chapter_id, series_slug, chapter_number, coins_paid, unlocked_at FROM unlocked_chapters WHERE user_id = ? ORDER BY unlocked_at DESC',
    )
    .all(userId) as Array<{
    chapter_id: string
    series_slug: string
    chapter_number: number
    coins_paid: number
    unlocked_at: string
  }>

  const unlockedChapterIds = unlockedChapters.map((r) => r.chapter_id)

  const readingHistory = db
    .prepare(
      'SELECT series_slug, chapter_number, percent, page, updated_at FROM reading_history WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20',
    )
    .all(userId) as Array<{
    series_slug: string
    chapter_number: number
    percent: number
    page: number
    updated_at: string
  }>

  const transactions = db
    .prepare(
      'SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
    )
    .all(userId) as unknown as DbWalletTxRow[]

  const latestCreatorRequest = db
    .prepare('SELECT * FROM creator_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(userId) as unknown as DbCreatorRequestRow | undefined

  const issues = db
    .prepare('SELECT * FROM issue_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(userId) as unknown as DbIssueReportRow[]

  return {
    user,
    librarySlugs,
    unlockedChapterIds,
    unlockedChapters,
    readingHistory,
    transactions,
    latestCreatorRequest: latestCreatorRequest ?? null,
    issues,
  }
}

export function creditTopupAtomically(params: {
  userId: string
  reference: string
  provider: 'promptpay' | 'truemoney'
  recipientId: string
  coins: number
  amountTHB: number
  slipUrl?: string | null
  slipHash?: string | null
  verificationNote: string
  upgradeToPlus?: boolean
}) {
  const db = getDb()
  const now = new Date().toISOString()
  const txId = `tx-${crypto.randomUUID()}`

  db.exec('BEGIN IMMEDIATE')
  try {
    const dup = db
      .prepare('SELECT id FROM wallet_transactions WHERE reference = ? LIMIT 1')
      .get(params.reference) as { id: string } | undefined
    if (dup) {
      throw new Error('DUPLICATE_REFERENCE')
    }

    if (params.slipHash) {
      const dupSlip = db
        .prepare('SELECT id FROM wallet_transactions WHERE slip_hash = ? LIMIT 1')
        .get(params.slipHash) as { id: string } | undefined
      if (dupSlip) {
        throw new Error('DUPLICATE_SLIP')
      }
    }

    db.prepare(`
      INSERT INTO wallet_transactions (
        id, reference, user_id, provider, recipient_id, type, coins, amount_thb, status, slip_url, slip_hash, verification_note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
    `).run(
      txId,
      params.reference,
      params.userId,
      params.provider,
      params.recipientId,
      params.upgradeToPlus ? 'subscription' : 'topup',
      params.coins,
      params.amountTHB,
      params.slipUrl ?? null,
      params.slipHash ?? null,
      params.verificationNote,
      now,
    )

    if (params.upgradeToPlus) {
      db.prepare(
        "UPDATE users SET plan = 'plus', coin_balance = coin_balance + ?, updated_at = ? WHERE id = ?",
      ).run(params.coins, now, params.userId)
    } else {
      db.prepare(
        'UPDATE users SET coin_balance = coin_balance + ?, updated_at = ? WHERE id = ?',
      ).run(params.coins, now, params.userId)
    }

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  return {
    transaction: db
      .prepare('SELECT * FROM wallet_transactions WHERE id = ?')
      .get(txId) as unknown as DbWalletTxRow,
    user: findUserById(params.userId)!,
  }
}

export function getAnalyticsDashboardData() {
  const db = getDb()

  const summary = db
    .prepare(`
      SELECT
        COALESCE((SELECT SUM(amount_thb) FROM wallet_transactions WHERE type IN ('topup', 'subscription') AND status = 'completed'), 0) AS total_revenue_thb,
        COALESCE((SELECT SUM(coins) FROM wallet_transactions WHERE type IN ('topup', 'subscription') AND status = 'completed'), 0) AS total_coins_issued,
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'creator') AS total_creators,
        (SELECT COUNT(*) FROM creator_requests WHERE status = 'pending') AS pending_creator_requests,
        (SELECT COUNT(*) FROM comments) AS total_comments,
        (SELECT COUNT(*) FROM issue_reports WHERE status != 'resolved') AS open_issues,
        (SELECT COUNT(*) FROM system_logs) AS total_logs,
        COALESCE((SELECT SUM(views_count) FROM series_stats), 0) AS total_views
    `)
    .get() as {
    total_revenue_thb: number
    total_coins_issued: number
    total_users: number
    total_creators: number
    pending_creator_requests: number
    total_comments: number
    open_issues: number
    total_logs: number
    total_views: number
  }

  const topSpenders = db
    .prepare(`
      SELECT
        u.id,
        u.display_name,
        u.email,
        u.role,
        u.creator_status,
        u.avatar_url,
        u.avatar_frame,
        u.plan,
        u.coin_balance,
        COALESCE(SUM(CASE WHEN wt.type = 'topup' AND wt.status = 'completed' THEN wt.amount_thb ELSE 0 END), 0) AS total_topup_thb,
        COALESCE(SUM(CASE WHEN wt.type = 'topup' AND wt.status = 'completed' THEN wt.coins ELSE 0 END), 0) AS total_topup_coins,
        COUNT(CASE WHEN wt.type = 'topup' THEN 1 END) AS tx_count
      FROM users u
      LEFT JOIN wallet_transactions wt ON wt.user_id = u.id
      GROUP BY u.id
      ORDER BY total_topup_thb DESC, u.coin_balance DESC
      LIMIT 15
    `)
    .all() as Array<{
    id: string
    display_name: string
    email: string
    role: UserRole
    creator_status: CreatorStatus
    avatar_url: string | null
    avatar_frame: string
    plan: string
    coin_balance: number
    total_topup_thb: number
    total_topup_coins: number
    tx_count: number
  }>

  const popularSeries = db
    .prepare(`
      SELECT
        series_slug,
        views_count,
        likes_count,
        unlocks_count,
        CASE WHEN rating_count > 0 THEN ROUND(rating_sum / rating_count, 2) ELSE 4.8 END AS avg_rating
      FROM series_stats
      ORDER BY views_count DESC, likes_count DESC
      LIMIT 15
    `)
    .all() as Array<{
    series_slug: string
    views_count: number
    likes_count: number
    unlocks_count: number
    avg_rating: number
  }>

  const recentTransactions = db
    .prepare(`
      SELECT wt.*, u.display_name, u.avatar_url
      FROM wallet_transactions wt
      LEFT JOIN users u ON u.id = wt.user_id
      ORDER BY wt.created_at DESC
      LIMIT 20
    `)
    .all() as unknown as Array<DbWalletTxRow & { display_name: string | null; avatar_url: string | null }>

  const recentComments = db
    .prepare('SELECT * FROM comments ORDER BY created_at DESC LIMIT 25')
    .all() as unknown as DbCommentRow[]

  const creatorRequests = db
    .prepare('SELECT * FROM creator_requests ORDER BY CASE WHEN status = \'pending\' THEN 0 ELSE 1 END, created_at DESC LIMIT 30')
    .all() as unknown as DbCreatorRequestRow[]

  const allUsers = db
    .prepare('SELECT id, email, role, creator_status, display_name, avatar_url, avatar_frame, coin_balance, plan, created_at FROM users ORDER BY created_at DESC LIMIT 50')
    .all() as unknown as Array<Partial<DbUserRow>>

  const recentLogs = getSystemLogs(60)
  const issueReports = getAllIssues(40)
  const notifications = getAllNotifications()

  return {
    summary,
    topSpenders,
    popularSeries,
    recentTransactions,
    recentComments,
    creatorRequests,
    allUsers,
    recentLogs,
    issueReports,
    notifications,
  }
}

export function getSystemSetting(key: string): string | null {
  try {
    const row = getDb()
      .prepare('SELECT value FROM system_settings WHERE key = ? LIMIT 1')
      .get(key) as { value: string } | undefined
    return row && row.value.trim() ? row.value.trim() : null
  } catch {
    return null
  }
}

export function setSystemSettings(entries: Record<string, string | undefined | null>) {
  const db = getDb()
  const now = new Date().toISOString()
  const upsert = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `)
  for (const [k, v] of Object.entries(entries)) {
    if (typeof v === 'string') {
      upsert.run(k, v.trim(), now)
    }
  }
}

function maskKey(val: string | null): string {
  if (!val) return ''
  if (val.length <= 8) return '••••••••'
  return `${val.slice(0, 4)}••••${val.slice(-4)}`
}

export function getAllSystemSettingsSafe() {
  const dbGemini = getSystemSetting('gemini_api_key')
  const envGemini = process.env.GEMINI_API_KEY?.trim() || null
  const activeGemini = dbGemini || envGemini

  const dbSmtpPass = getSystemSetting('smtp_pass')
  const envSmtpPass = process.env.SMTP_PASS?.trim() || null

  const dbGhToken = getSystemSetting('github_token')
  const envGhToken = process.env.GITHUB_TOKEN?.trim() || null
  const activeGhToken = dbGhToken || envGhToken

  return {
    hasGeminiApiKey: Boolean(activeGemini),
    geminiKeySource: dbGemini ? 'admin-db' : envGemini ? 'env' : 'none',
    maskedGeminiKey: maskKey(activeGemini),
    geminiModelReasoning: getSystemSetting('gemini_model_reasoning') || 'gemini-4-hydrogen',
    geminiModelTts: getSystemSetting('gemini_model_tts') || 'gemini-3.8-flash-tts',
    geminiModelImage: getSystemSetting('gemini_model_image') || 'gemini-nano-banana-2.1',
    geminiModelDecision: getSystemSetting('gemini_model_decision') || 'gemini-decision-1',
    smtpHost: getSystemSetting('smtp_host') || process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: getSystemSetting('smtp_port') || process.env.SMTP_PORT || '587',
    smtpUser: getSystemSetting('smtp_user') || process.env.SMTP_USER || '',
    hasSmtpPass: Boolean(dbSmtpPass || envSmtpPass),
    smtpFrom: getSystemSetting('smtp_from') || process.env.SMTP_FROM || 'NIVATOON <no-reply@nivatoon.app>',
    strictSlipCheck: (getSystemSetting('strict_slip_check') ?? 'true') !== 'false',
    githubRepo: getSystemSetting('github_repo') || 'OhmmyTRC/nivatoon',
    githubBranch: getSystemSetting('github_branch') || 'main',
    hasGithubToken: Boolean(activeGhToken),
    maskedGithubToken: maskKey(activeGhToken),
    firebaseProjectId: 'niva-421c2',
  }
}

export function addSystemLog(
  level: 'info' | 'warn' | 'error' | 'security',
  category: string,
  message: string,
  actorEmail?: string | null,
  meta?: unknown,
) {
  try {
    const id = `log-${crypto.randomUUID()}`
    const now = new Date().toISOString()
    getDb()
      .prepare(`
        INSERT INTO system_logs (id, level, category, message, actor_email, meta_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        level,
        category.slice(0, 40),
        message.slice(0, 500),
        actorEmail ?? null,
        meta ? JSON.stringify(meta).slice(0, 1500) : null,
        now,
      )
    return id
  } catch {
    return null
  }
}

export function getSystemLogs(limit = 60): DbSystemLogRow[] {
  return getDb()
    .prepare('SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?')
    .all(limit) as unknown as DbSystemLogRow[]
}

export function getActiveNotifications(limit = 20): DbNotificationRow[] {
  return getDb()
    .prepare('SELECT * FROM notifications WHERE is_active = 1 ORDER BY created_at DESC LIMIT ?')
    .all(limit) as unknown as DbNotificationRow[]
}

export function getUserReadNotificationIds(userId: string): string[] {
  const rows = getDb()
    .prepare('SELECT notification_id FROM notification_reads WHERE user_id = ?')
    .all(userId) as Array<{ notification_id: string }>
  return rows.map((r) => r.notification_id)
}

export function markNotificationsReadForUser(
  userId: string,
  notificationIds?: string[],
): string[] {
  const db = getDb()
  const now = new Date().toISOString()
  const targets =
    Array.isArray(notificationIds) && notificationIds.length > 0
      ? notificationIds
      : getActiveNotifications(100).map((n) => n.id)

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO notification_reads (user_id, notification_id, read_at)
    VALUES (?, ?, ?)
  `)
  for (const nid of targets) {
    if (nid) stmt.run(userId, String(nid), now)
  }
  return getUserReadNotificationIds(userId)
}

export function getNotificationsWithReadState(userId?: string | null, limit = 25) {
  const rows = getActiveNotifications(limit)
  const readIds = userId ? getUserReadNotificationIds(userId) : []
  const readSet = new Set(readIds)
  const notifications = rows.map((n) => ({
    ...n,
    isRead: readSet.has(n.id),
  }))
  const unreadCount = notifications.filter((n) => !n.isRead).length
  return { notifications, readIds, unreadCount }
}

export function getAllNotifications(limit = 40): DbNotificationRow[] {
  return getDb()
    .prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?')
    .all(limit) as unknown as DbNotificationRow[]
}

export function getUserIssues(userId: string): DbIssueReportRow[] {
  return getDb()
    .prepare('SELECT * FROM issue_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
    .all(userId) as unknown as DbIssueReportRow[]
}

export function getAllIssues(limit = 50): DbIssueReportRow[] {
  return getDb()
    .prepare('SELECT * FROM issue_reports ORDER BY CASE WHEN status = \'open\' THEN 0 WHEN status = \'investigating\' THEN 1 ELSE 2 END, created_at DESC LIMIT ?')
    .all(limit) as unknown as DbIssueReportRow[]
}
