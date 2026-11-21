'use client'

import { useEffect, useState } from 'react'
import {
  type ComicSeriesRecord,
  type EpisodeCommentRecord,
  STARTER_COMMENTS,
  STARTER_SERIES,
  type WalletTxRecord,
} from '@/lib/database'
import { applyDocumentTheme } from '@/components/pwa/PwaSupport'

export type UserRole = 'user' | 'creator' | 'admin'
export type CreatorStatus = 'none' | 'pending' | 'approved' | 'rejected'

export interface AuthPublicUser {
  id: string
  email: string
  provider: string
  role: UserRole
  creatorStatus: CreatorStatus
  displayName: string
  avatarUrl: string | null
  avatarFrame: string
  bio: string
  bannerTheme: string
  coinBalance: number
  freePassTickets: number
  plan: 'free' | 'plus'
  checkinDay: number
  lastCheckinDate: string
  themeMode: 'light' | 'dark'
  hasPin: boolean
  hasBiometric: boolean
  biometricCredentialId: string | null
  biometricLabel: string | null
}

export interface CreatorRequestItem {
  id: string
  pen_name: string
  sample_title: string
  portfolio_note: string
  sample_cover_url?: string | null
  sample_pages_json?: string | null
  sample_synopsis?: string | null
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
  created_at: string
}

export interface UnlockedChapterDetail {
  chapter_id: string
  series_slug: string
  chapter_number: number
  coins_paid: number
  unlocked_at: string
}

export interface IssueReportItem {
  id: string
  category: string
  subject: string
  description: string
  page_url: string | null
  status: 'open' | 'investigating' | 'resolved'
  admin_reply: string | null
  created_at: string
  updated_at: string
}

export interface AppNotificationItem {
  id: string
  title: string
  message: string
  type: 'promo' | 'announcement' | 'update'
  badge: string
  cta_url: string | null
  is_active: number
  created_at: string
  isRead?: boolean
}

export interface NivatoonUserState {
  displayName: string
  email: string
  avatarUrl: string | null
  avatarFrame: string
  bio: string
  bannerTheme: string
  coinBalance: number
  freePassTickets: number
  plan: 'free' | 'plus'
  checkinDay: number
  lastCheckinDate: string
  themeMode: 'light' | 'dark'
  librarySlugs: string[]
  bellMutedSlugs: string[]
  unlockedChapterIds: string[]
  unlockedChapters: UnlockedChapterDetail[]
  likedEpisodeIds: string[]
  episodeReactions: Record<string, Record<string, number>>
  userRatings: Record<string, number>
  comments: EpisodeCommentRecord[]
  readingHistory: {
    seriesSlug: string
    chapterNumber: number
    percent: number
    page: number
    updatedAt: string
  }[]
  transactions: WalletTxRecord[]
  issues: IssueReportItem[]
  selectedTopupPackageId: string
  selectedTopupCoins: number
  selectedTopupTHB: number
}

export const DEFAULT_USER_STATE: NivatoonUserState = {
  displayName: 'นักอ่านสมาชิก',
  email: '',
  avatarUrl: null,
  avatarFrame: 'emerald',
  bio: '',
  bannerTheme: 'midnight',
  coinBalance: 0,
  freePassTickets: 3,
  plan: 'free',
  checkinDay: 0,
  lastCheckinDate: '',
  themeMode: 'light',
  librarySlugs: [],
  bellMutedSlugs: [],
  unlockedChapterIds: [],
  unlockedChapters: [],
  likedEpisodeIds: [],
  episodeReactions: {
    'moonlit-sword-ep-1': { hype: 320, emotional: 84, funny: 19, shocked: 142 },
  },
  userRatings: {},
  comments: STARTER_COMMENTS,
  readingHistory: [],
  transactions: [],
  issues: [],
  selectedTopupPackageId: 'pkg-550',
  selectedTopupCoins: 600,
  selectedTopupTHB: 149,
}

const STORAGE_KEY = 'nivatoon_db_state_v5'

export function useNivatoonDatabase(initialSeries?: ComicSeriesRecord[]) {
  const [seriesList, setSeriesList] = useState<ComicSeriesRecord[]>(
    initialSeries && initialSeries.length > 0 ? initialSeries : STARTER_SERIES,
  )
  const [state, setState] = useState<NivatoonUserState>(DEFAULT_USER_STATE)
  const [searchQuery, setSearchQuery] = useState('')
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const [firebaseConnected, setFirebaseConnected] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [authUser, setAuthUser] = useState<AuthPublicUser | null>(null)
  const [latestCreatorRequest, setLatestCreatorRequest] = useState<CreatorRequestItem | null>(null)
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [authLoaded, setAuthLoaded] = useState(false)

  const refreshNotifications = async () => {
    try {
      const r = await fetch('/api/notifications', { cache: 'no-store' })
      const data = await r.json()
      if (Array.isArray(data?.notifications)) {
        setNotifications(data.notifications)
        setUnreadNotificationCount(
          typeof data.unreadCount === 'number'
            ? data.unreadCount
            : data.notifications.filter((n: any) => !n.isRead).length,
        )
      }
    } catch {}
  }

  const markNotificationsRead = async (ids?: string[]) => {
    const idSet = ids && ids.length > 0 ? new Set(ids) : null
    setNotifications((prev) =>
      prev.map((n) => (!idSet || idSet.has(n.id) ? { ...n, isRead: true } : n)),
    )
    setUnreadNotificationCount((prevCount) => (idSet ? Math.max(0, prevCount - idSet.size) : 0))
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids && ids.length > 0 ? { notificationIds: ids } : { markAll: true }),
      })
      const data = await res.json()
      if (Array.isArray(data?.notifications)) {
        setNotifications(data.notifications)
        setUnreadNotificationCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0)
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('nivatoon:notifications-read'))
      }
    } catch {}
  }

  const syncFromServerAuth = async () => {
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' })
      const data = await r.json()
      setFirebaseConnected(Boolean(data?.firebaseConnected))
      setAuthenticated(Boolean(data?.authenticated))
      setUnlocked(Boolean(data?.unlocked))
      if (data?.authenticated && data?.user) {
        const u = data.user as AuthPublicUser
        setAuthUser(u)
        const b = data.bundle
        setLatestCreatorRequest(b?.latestCreatorRequest ?? null)
        const themeMode = u.themeMode === 'dark' ? 'dark' : 'light'
        applyDocumentTheme(themeMode)
        setState((prev) => ({
          ...prev,
          displayName: u.displayName,
          email: u.email,
          avatarUrl: u.avatarUrl,
          avatarFrame: u.avatarFrame || 'emerald',
          bio: u.bio || '',
          bannerTheme: u.bannerTheme || 'midnight',
          coinBalance: u.coinBalance,
          freePassTickets: u.freePassTickets,
          plan: u.plan,
          checkinDay: u.checkinDay ?? 0,
          lastCheckinDate: u.lastCheckinDate || '',
          themeMode,
          librarySlugs: Array.isArray(b?.librarySlugs) ? b.librarySlugs : prev.librarySlugs,
          unlockedChapterIds: Array.isArray(b?.unlockedChapterIds)
            ? b.unlockedChapterIds
            : prev.unlockedChapterIds,
          unlockedChapters: Array.isArray(b?.unlockedChapters)
            ? b.unlockedChapters
            : prev.unlockedChapters,
          readingHistory: Array.isArray(b?.readingHistory)
            ? b.readingHistory.map((h: any) => ({
                seriesSlug: h.series_slug,
                chapterNumber: h.chapter_number,
                percent: h.percent,
                page: h.page,
                updatedAt: h.updated_at?.slice(0, 16).replace('T', ' ') || 'ล่าสุด',
              }))
            : prev.readingHistory,
          transactions: Array.isArray(b?.transactions)
            ? b.transactions.map((t: any) => ({
                id: t.id,
                reference: t.reference,
                title: t.verification_note || `${t.provider} (${t.type})`,
                type: t.type,
                coins: t.coins,
                amountTHB: t.amount_thb,
                status: t.status,
                provider: t.provider,
                dateLabel: t.created_at?.slice(0, 16).replace('T', ' ') || 'สำเร็จ',
              }))
            : prev.transactions,
          issues: Array.isArray(b?.issues) ? b.issues : prev.issues,
        }))
      } else {
        setAuthUser(null)
        setLatestCreatorRequest(null)
      }
    } catch {
    } finally {
      setAuthLoaded(true)
    }
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setState((prev) => ({ ...prev, ...JSON.parse(saved) }))
      }
    } catch {}

    fetch('/api/database')
      .then((r) => r.json())
      .then((data) => {
        if (data?.series?.length) setSeriesList(data.series)
      })
      .catch(() => {})

    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((data) => setAiConfigured(Boolean(data?.configured)))
      .catch(() => setAiConfigured(false))

    void refreshNotifications()
    void syncFromServerAuth()

    const onNotifsRead = () => {
      void refreshNotifications()
    }
    window.addEventListener('nivatoon:notifications-read', onNotifsRead)
    return () => window.removeEventListener('nivatoon:notifications-read', onNotifsRead)
  }, [])

  const selectTopupPackage = (pkgId: string, totalCoins: number, thb: number) => {
    setState((prev) => {
      const next = {
        ...prev,
        selectedTopupPackageId: pkgId,
        selectedTopupCoins: totalCoins,
        selectedTopupTHB: thb,
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
    // Persist synchronously before Next.js route transition so /wallet/payment never reads stale 149 THB default
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY)
      const base = existing ? JSON.parse(existing) : DEFAULT_USER_STATE
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...base,
          selectedTopupPackageId: pkgId,
          selectedTopupCoins: totalCoins,
          selectedTopupTHB: thb,
        }),
      )
    } catch {}
  }

  const updateState = (
    updater: (prev: NivatoonUserState) => NivatoonUserState,
    syncAction?: string,
    syncPayload?: Record<string, unknown>,
  ) => {
    setState((prev) => {
      const next = updater(prev)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })

    if (syncAction) {
      fetch('/api/user-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: syncAction, ...(syncPayload ?? {}) }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res?.user) {
            setAuthUser(res.user)
            setState((prev) => ({
              ...prev,
              coinBalance: res.user.coinBalance,
              freePassTickets: res.user.freePassTickets,
              checkinDay: res.user.checkinDay ?? prev.checkinDay,
              lastCheckinDate: res.user.lastCheckinDate || prev.lastCheckinDate,
            }))
          }
        })
        .catch(() => {})
    }
  }

  const saveThemePreference = async (themeMode: 'light' | 'dark') => {
    applyDocumentTheme(themeMode)
    setState((prev) => {
      const next = { ...prev, themeMode }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeMode }),
    })
    const data = await res.json()
    if (data?.user) setAuthUser(data.user)
    return data
  }

  const refreshSeries = async () => {
    try {
      const r = await fetch('/api/database')
      const data = await r.json()
      if (data?.series?.length) setSeriesList(data.series)
    } catch {}
  }

  return {
    seriesList,
    refreshSeries,
    state,
    updateState,
    selectTopupPackage,
    saveThemePreference,
    searchQuery,
    setSearchQuery,
    aiConfigured,
    firebaseConnected,
    authenticated,
    unlocked,
    authUser,
    latestCreatorRequest,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
    authLoaded,
    refreshAuth: syncFromServerAuth,
  }
}
