'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CoinBadgeIcon, Icon, TicketBadgeIcon } from './icons'
import { type ComicSeriesRecord } from '@/lib/database'
import type { AppNotificationItem, UserRole } from './store'

const GENRE_THAI: Record<string, string> = {
  action: 'แอ็กชัน',
  fantasy: 'แฟนตาซี',
  romance: 'โรแมนซ์',
  drama: 'ดราม่า',
  comedy: 'คอมเมดี้',
  historical: 'ย้อนยุค',
}

export const FRAME_STYLES: Record<string, string> = {
  emerald: 'ring-2 ring-[#00dc64]',
  gold: 'ring-2 ring-amber-400',
  neon: 'ring-2 ring-lime-400',
  rose: 'ring-2 ring-rose-400',
  royal: 'ring-2 ring-violet-500',
}

export function formatLikesShort(slug: string, rating: number): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) % 900
  const base = (rating * 180 + hash) / 100
  return `${base.toFixed(1)}M`
}

export function Header({
  coinBalance = 0,
  freePassTickets = 3,
  searchQuery = '',
  onSearchChange,
  authenticated = false,
  role = 'user',
  displayName,
  avatarUrl,
  avatarFrame = 'emerald',
  notifications = [],
  unreadNotificationCount,
  onMarkNotificationsRead,
}: {
  coinBalance?: number
  freePassTickets?: number
  searchQuery?: string
  onSearchChange?: (q: string) => void
  aiConfigured?: boolean | null
  authenticated?: boolean
  role?: UserRole
  displayName?: string
  avatarUrl?: string | null
  avatarFrame?: string
  notifications?: AppNotificationItem[]
  unreadNotificationCount?: number
  onMarkNotificationsRead?: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [liveNotifs, setLiveNotifs] = useState<AppNotificationItem[]>(notifications)
  const [localUnread, setLocalUnread] = useState<number>(
    typeof unreadNotificationCount === 'number'
      ? unreadNotificationCount
      : notifications.filter((n) => !n.isRead).length,
  )

  useEffect(() => {
    if (notifications.length > 0) {
      setLiveNotifs(notifications)
      setLocalUnread(
        typeof unreadNotificationCount === 'number'
          ? unreadNotificationCount
          : notifications.filter((n) => !n.isRead).length,
      )
      return
    }
    fetch('/api/notifications', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.notifications)) {
          setLiveNotifs(d.notifications)
          setLocalUnread(
            typeof d.unreadCount === 'number'
              ? d.unreadCount
              : d.notifications.filter((n: any) => !n.isRead).length,
          )
        }
      })
      .catch(() => {})
  }, [notifications, unreadNotificationCount])

  useEffect(() => {
    const syncRead = () => {
      setLocalUnread(0)
      setLiveNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })))
    }
    window.addEventListener('nivatoon:notifications-read', syncRead)
    return () => window.removeEventListener('nivatoon:notifications-read', syncRead)
  }, [])

  const handleToggleNotifMenu = () => {
    const nextOpen = !showNotifMenu
    setShowNotifMenu(nextOpen)
    if (nextOpen && localUnread > 0) {
      setLocalUnread(0)
      setLiveNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })))
      if (onMarkNotificationsRead) {
        onMarkNotificationsRead()
      } else {
        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markAll: true }),
        }).catch(() => {})
      }
      window.dispatchEvent(new Event('nivatoon:notifications-read'))
    }
  }

  const handleLockApp = async () => {
    try {
      await fetch('/api/auth/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock' }),
      })
      router.push('/security-gate')
    } catch {}
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 text-lg font-black tracking-tight text-zinc-950 sm:gap-2 sm:text-xl"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-[#00dc64] text-sm font-black text-white shadow-sm sm:size-8 sm:text-base">
              N
            </span>
            <span className="xs:inline">NIVATOON</span>
          </Link>

          <nav className="ml-2 hidden shrink-0 items-center gap-4 whitespace-nowrap text-sm font-bold text-zinc-600 lg:ml-4 lg:gap-5 md:flex">
            <Link
              href="/"
              className={pathname === '/' ? 'font-black text-zinc-950' : 'hover:text-zinc-950'}
            >
              หน้าหลัก
            </Link>
            <Link
              href="/schedule"
              className={
                pathname === '/schedule' ? 'font-black text-zinc-950' : 'hover:text-zinc-950'
              }
            >
              ประจำวัน
            </Link>
            <Link
              href="/ranking"
              className={
                pathname === '/ranking' ? 'font-black text-zinc-950' : 'hover:text-zinc-950'
              }
            >
              อันดับ
            </Link>
            <Link
              href="/canvas"
              className={
                pathname === '/canvas' ? 'font-black text-zinc-950' : 'hover:text-zinc-950'
              }
            >
              CANVAS
            </Link>
            <Link
              href="/library"
              className={
                pathname === '/library' ? 'font-black text-zinc-950' : 'hover:text-zinc-950'
              }
            >
              เว็บตูนของฉัน
            </Link>
          </nav>

          {/* Search Pill */}
          <div className="ml-auto hidden w-44 items-center gap-2 rounded-full bg-zinc-100 px-3.5 py-2 md:flex lg:w-60">
            <Icon name="search" className="size-4 shrink-0 text-zinc-500" />
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = searchQuery.trim()
                  router.push(q ? `/discover?q=${encodeURIComponent(q)}` : '/discover')
                }
              }}
              placeholder="ลองหาเรื่อง, ครีเอเตอร์, หมวดหมู่..."
              className="w-full bg-transparent text-xs font-medium text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap sm:gap-2 md:ml-0">
            {/* Mobile Quick Search Button */}
            <Link
              href="/discover"
              aria-label="ค้นหาเรื่อง"
              className="grid size-8 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:border-[#00dc64] md:hidden"
            >
              <Icon name="search" className="size-4" />
            </Link>

            {/* Role-specific quick access: ONLY visible for Creator or Admin */}
            {authenticated && (role === 'creator' || role === 'admin') && (
              <Link
                href="/studio"
                className="hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#00dc64]/15 px-3 py-1.5 text-xs font-black text-[#009944] sm:flex"
              >
                <Icon name="upload" className="size-3.5" />
                อัพผลงาน
              </Link>
            )}

            {authenticated && role === 'admin' && (
              <Link
                href="/dashboard"
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-zinc-950 px-2.5 py-1.5 text-[11px] font-black text-[#00dc64] sm:px-3 sm:text-xs"
              >
                <Icon name="shield" className="size-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            {/* Notifications & Promo Bell Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={handleToggleNotifMenu}
                aria-label="การแจ้งเตือนและโปรโมชั่น"
                className="relative grid size-8 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:border-[#00dc64]"
              >
                <Icon name="bell" className="size-4" />
                {localUnread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                    {localUnread > 9 ? '9+' : localUnread}
                  </span>
                )}
              </button>

              {showNotifMenu && (
                <div className="fixed inset-x-3 top-16 z-50 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-80">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                    <b className="text-sm font-black">แจ้งเตือน &amp; โปรโมชั่น</b>
                    <button
                      type="button"
                      onClick={() => setShowNotifMenu(false)}
                      className="text-xs font-bold text-zinc-400"
                    >
                      ปิด ✕
                    </button>
                  </div>
                  <div className="mt-2.5 max-h-72 space-y-2.5 overflow-y-auto">
                    {liveNotifs.length === 0 ? (
                      <p className="py-4 text-center text-xs text-zinc-400">ยังไม่มีการแจ้งเตือนใหม่</p>
                    ) : (
                      liveNotifs.slice(0, 5).map((n) => (
                        <Link
                          key={n.id}
                          href={n.cta_url || '/notifications'}
                          onClick={() => setShowNotifMenu(false)}
                          className="block rounded-xl border border-zinc-100 bg-zinc-50 p-3 hover:border-[#00dc64]"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-[#00dc64] px-1.5 py-0.5 text-[9px] font-black text-white">
                              {n.badge || 'PROMO'}
                            </span>
                            <b className="line-clamp-1 flex-1 text-xs">{n.title}</b>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{n.message}</p>
                        </Link>
                      ))
                    )}
                  </div>
                  <Link
                    href="/notifications"
                    onClick={() => setShowNotifMenu(false)}
                    className="mt-3 block rounded-xl bg-zinc-100 py-2 text-center text-xs font-black text-zinc-900"
                  >
                    ดูการแจ้งเตือนทั้งหมด →
                  </Link>
                </div>
              )}
            </div>

            {/* Free Tickets Badge */}
            <Link
              href="/profile"
              title="ตั๋วอ่านฟรีคงเหลือ"
              className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-800 sm:flex"
            >
              <TicketBadgeIcon className="size-4" />
              <span>{freePassTickets}</span>
            </Link>

            {/* Improved Golden Coin Badge */}
            <Link
              href="/wallet/topup"
              title="เหรียญของฉัน / ร้านค้าเหรียญ"
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-xs font-black text-zinc-900 hover:border-amber-400 sm:gap-1.5 sm:px-3"
            >
              <CoinBadgeIcon className="size-4" />
              {coinBalance.toLocaleString()}
            </Link>

            {authenticated ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleLockApp}
                  title="ล็อกหน้าจอความปลอดภัย"
                  className="hidden size-8 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 hover:text-zinc-950 sm:grid"
                >
                  <Icon name="lock" className="size-3.5" />
                </button>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-2.5 text-xs font-bold text-zinc-900"
                >
                  <span
                    className={`grid size-7 place-items-center overflow-hidden rounded-full bg-zinc-900 text-xs font-black text-[#00dc64] ${
                      FRAME_STYLES[avatarFrame] ?? FRAME_STYLES.emerald
                    }`}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="size-full object-cover" />
                    ) : (
                      (displayName?.[0] || 'U').toUpperCase()
                    )}
                  </span>
                  <span className="hidden max-w-24 truncate lg:inline">{displayName}</span>
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="shrink-0 whitespace-nowrap rounded-full bg-[#00dc64] px-4 py-2 text-xs font-black text-white shadow-sm hover:brightness-95"
              >
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Floating Pill Bottom Navigation */}
      <nav
        aria-label="แถบนำทางหลัก"
        className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-full border border-zinc-200/90 bg-white/95 px-2 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5 items-center text-center text-[10px] font-bold">
          {[
            { href: '/', icon: 'home', label: 'หน้าหลัก' },
            { href: '/schedule', icon: 'calendar', label: 'ประจำวัน' },
            { href: '/discover', icon: 'search', label: 'ค้นหา' },
            { href: '/canvas', icon: 'grid', label: 'CANVAS' },
            { href: '/profile', icon: 'user', label: 'เว็บตูนของฉัน' },
          ].map((tab) => {
            const active =
              tab.href === '/'
                ? pathname === '/'
                : pathname === tab.href || pathname.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 rounded-full py-1.5 transition ${
                  active ? 'bg-zinc-100 font-black text-zinc-950' : 'text-zinc-500'
                }`}
              >
                <Icon
                  name={tab.icon}
                  className={`size-4 ${active ? 'text-[#00c75a]' : 'text-zinc-500'}`}
                />
                <span className="truncate">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-zinc-200 bg-zinc-50 pb-24 text-zinc-600 md:pb-12">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2 text-xl font-black text-zinc-950">
            <span className="grid size-7 place-items-center rounded-lg bg-[#00dc64] text-sm text-white">
              N
            </span>
            NIVATOON
          </div>
          <p className="mt-3 max-w-xs text-xs leading-6 text-zinc-500">
            แพลตฟอร์มอ่านมังฮวา มังงะ และมันฮัวออนไลน์ ใช้ GitHub (OhmmyTRC/nivatoon) เป็นคลังเก็บไฟล์ภาพ และ Firebase (niva-421c2) เป็นฐานข้อมูลคลาวด์
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/nivatoon-release.apk"
              download="nivatoon-release.apk"
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-black text-[#00dc64] shadow-sm hover:bg-zinc-800"
            >
              📱 ดาวน์โหลดแอป Android (.APK)
            </a>
          </div>
        </div>
        <div className="text-xs">
          <b className="text-zinc-950">สำรวจเรื่อง</b>
          <div className="mt-3 grid gap-2.5">
            <Link href="/schedule">ตารางอัปเดตประจำวัน</Link>
            <Link href="/ranking">อันดับยอดนิยม</Link>
            <Link href="/discover">ค้นหาและหมวดหมู่</Link>
            <Link href="/canvas">CANVAS ครีเอเตอร์</Link>
          </div>
        </div>
        <div className="text-xs">
          <b className="text-zinc-950">บัญชีและเหรียญ</b>
          <div className="mt-3 grid gap-2.5">
            <Link href="/library">รายการล่าสุด &amp; ติดตาม</Link>
            <Link href="/wallet/topup">ร้านค้าเหรียญ</Link>
            <Link href="/plans">NIVATOON Plus</Link>
            <Link href="/profile">โปรไฟล์ &amp; ตั๋วอ่านฟรี</Link>
          </div>
        </div>
        <div className="text-xs">
          <b className="text-zinc-950">ตั้งค่า &amp; ช่วยเหลือ</b>
          <div className="mt-3 grid gap-2.5">
            <Link href="/notifications">แจ้งเตือน &amp; โปรโมชั่น</Link>
            <Link href="/support">แจ้งปัญหาการใช้งาน</Link>
            <Link href="/settings">ตั้งค่าธีม &amp; รหัสผ่าน &amp; PIN</Link>
            <Link href="/terms">ข้อกำหนดการใช้งาน</Link>
            <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

export function ComicCard({
  item,
  index,
  rankBadge,
}: {
  item: ComicSeriesRecord
  index: number
  rankBadge?: boolean
}) {
  const primaryGenre = GENRE_THAI[item.genres[0] || 'action'] || 'แอ็กชัน'
  const likes = formatLikesShort(item.slug, item.rating)

  return (
    <Link href={`/series/${encodeURIComponent(item.slug)}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-zinc-200 shadow-sm">
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={item.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className={`size-full bg-gradient-to-br ${item.tone}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

        <div className="absolute left-2 top-2 flex items-center gap-1">
          <span className="rounded bg-[#00dc64] px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm">
            {item.status === 'completed' ? 'จบแล้ว' : 'ตอนใหม่'}
          </span>
        </div>

        {rankBadge && (
          <span className="absolute bottom-1.5 right-2.5 text-3xl font-black italic text-white drop-shadow">
            {index + 1}
          </span>
        )}
      </div>

      <p className="mt-2 text-[11px] font-medium text-zinc-400">{primaryGenre}</p>
      <h3 className="line-clamp-1 text-sm font-bold text-zinc-950 group-hover:text-[#00a84b]">
        {item.title}
      </h3>
      <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-[#00c75a]">
        <span>♥</span>
        <span>{likes}</span>
      </div>
    </Link>
  )
}

export function SectionTitle({
  title,
  href = '/discover',
  linkLabel = 'ดูทั้งหมด',
}: {
  eyebrow?: string
  title: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-black tracking-tight text-zinc-950 md:text-2xl">
        {title}
      </h2>
      <Link
        href={href}
        className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-zinc-500 hover:text-zinc-950"
      >
        {linkLabel} <Icon name="arrow" className="size-3.5" />
      </Link>
    </div>
  )
}
