'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Icon, TicketBadgeIcon } from './icons'
import { ComicCard, Footer, formatLikesShort, Header, SectionTitle } from './chrome'
import { useNivatoonDatabase } from './store'
import { type ComicSeriesRecord } from '@/lib/database'

const SCHEDULE_TABS = [
  'จบบริบูรณ์',
  'จันทร์',
  'อังคาร',
  'พุธ',
  'พฤหัส',
  'ศุกร์',
  'เสาร์',
  'อาทิตย์',
]

const GENRE_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'romance', label: 'โรแมนซ์' },
  { key: 'fantasy', label: 'โรแมนซ์แฟนตาซี' },
  { key: 'drama', label: 'ดราม่า' },
  { key: 'action', label: 'แอ็กชัน' },
  { key: 'comedy', label: 'คอมเมดี้' },
  { key: 'historical', label: 'ย้อนยุค' },
]

const GENRE_THAI_MAP: Record<string, string> = {
  action: 'แอ็กชัน',
  fantasy: 'โรแมนซ์แฟนตาซี',
  romance: 'โรแมนซ์',
  drama: 'ดราม่า',
  comedy: 'คอมเมดี้',
  historical: 'ย้อนยุค',
}

export function Home({ initialSeries }: { initialSeries?: ComicSeriesRecord[] }) {
  const {
    seriesList,
    state,
    updateState,
    searchQuery,
    setSearchQuery,
    authenticated,
    authUser,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
  } = useNivatoonDatabase(initialSeries)

  const featuredSlides = seriesList.slice(0, 5)
  const [slideIdx, setSlideIdx] = useState(0)
  const activeHero = featuredSlides[slideIdx % Math.max(1, featuredSlides.length)] ?? seriesList[0]

  const [homeGenre, setHomeGenre] = useState<string>('all')
  const [showPromoModal, setShowPromoModal] = useState(false)

  const lastRead = state.readingHistory[0]
  const lastReadSeries =
    seriesList.find((s) => s.slug === lastRead?.seriesSlug) ?? seriesList[0]

  const todayKey = new Date().toISOString().slice(0, 10)
  const checkedInToday = state.lastCheckinDate === todayKey
  const completedCycleDays = state.checkinDay ?? 0
  const nextCycleDay = (completedCycleDays % 7) + 1
  const nextTicketReward = nextCycleDay === 7 ? 3 : 1

  const curatedSeries = useMemo(() => {
    if (homeGenre === 'all') return seriesList.slice(0, 10)
    return seriesList.filter((s) => s.genres.includes(homeGenre))
  }, [seriesList, homeGenre])

  const handleDailyCheckin = () => {
    if (checkedInToday) return
    updateState(
      (prev) => ({
        ...prev,
        freePassTickets: prev.freePassTickets + nextTicketReward,
        checkinDay: nextCycleDay,
        lastCheckinDate: todayKey,
      }),
      'daily_checkin',
      {},
    )
    setShowPromoModal(false)
  }

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <Header
        coinBalance={state.coinBalance}
        freePassTickets={state.freePassTickets}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        authenticated={authenticated}
        role={authUser?.role ?? 'user'}
        displayName={authUser?.displayName || state.displayName}
        avatarUrl={authUser?.avatarUrl || state.avatarUrl}
        avatarFrame={authUser?.avatarFrame || state.avatarFrame}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        onMarkNotificationsRead={() => void markNotificationsRead()}
      />

      <main className="mx-auto max-w-[1280px] space-y-8 px-3 py-4 pb-24 sm:space-y-10 sm:px-4 sm:py-5 md:pb-6 lg:px-8">
        {/* Hero Spotlight Carousel (Webtoon Clean Card Banner) */}
        <section className="relative overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-lg">
          {activeHero?.coverUrl && (
            <img
              src={activeHero.coverUrl}
              alt={activeHero.title}
              className="absolute inset-0 size-full object-cover object-center opacity-55"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-transparent" />

          <div className="relative z-10 grid min-h-[340px] items-center gap-6 p-6 md:min-h-[420px] md:grid-cols-[1.3fr_0.7fr] md:p-12">
            <div className="max-w-xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#00dc64] px-2.5 py-0.5 text-[11px] font-black text-white">
                  แนะนำประจำสัปดาห์
                </span>
                <span className="rounded bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">
                  {GENRE_THAI_MAP[activeHero.genres[0] || 'action'] || 'แอ็กชัน'}
                </span>
              </div>
              <h1 className="text-3xl font-black leading-tight md:text-5xl">
                {activeHero.title}
              </h1>
              <p className="mt-2 text-xs font-bold text-white/70">
                โดย {activeHero.author} • อัปเดตทุกวัน{activeHero.updateDay}
              </p>
              <p className="mt-3 line-clamp-2 max-w-lg text-sm leading-6 text-white/80">
                {activeHero.synopsis}
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link
                  href={`/read/${encodeURIComponent(activeHero.slug)}/1`}
                  className="flex items-center gap-1.5 rounded-full bg-[#00dc64] px-6 py-2.5 text-sm font-black text-white shadow-sm hover:brightness-95"
                >
                  <Icon name="play" className="size-4" /> อ่านตอนแรก
                </Link>
                <Link
                  href={`/series/${encodeURIComponent(activeHero.slug)}`}
                  className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold backdrop-blur hover:bg-white/20"
                >
                  รายละเอียด
                </Link>
              </div>
            </div>

            {activeHero?.coverUrl && (
              <div className="hidden justify-self-end md:block">
                <Link
                  href={`/series/${encodeURIComponent(activeHero.slug)}`}
                  className="block w-52 overflow-hidden rounded-xl border border-white/20 shadow-2xl transition hover:scale-[1.02]"
                >
                  <img
                    src={activeHero.coverUrl}
                    alt={activeHero.title}
                    className="aspect-[3/4] w-full object-cover"
                  />
                </Link>
              </div>
            )}
          </div>

          <div className="absolute bottom-4 right-5 z-10 flex items-center gap-2">
            {featuredSlides.map((s, i) => (
              <button
                type="button"
                key={s.slug}
                aria-label={`สไลด์ ${i + 1}`}
                onClick={() => setSlideIdx(i)}
                className={`h-2 rounded-full transition-all ${
                  i === slideIdx ? 'w-6 bg-[#00dc64]' : 'w-2 bg-white/40'
                }`}
              />
            ))}
          </div>
        </section>

        {/* Curated Picks with Real Genre Filter Chips (Screenshot #9 inspired) */}
        <section>
          <SectionTitle title="เรื่องเด็ดน่าติดตาม" href="/discover" />
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {GENRE_FILTERS.map((g) => (
              <button
                type="button"
                key={g.key}
                onClick={() => setHomeGenre(g.key)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  homeGenre === g.key
                    ? 'bg-zinc-950 text-white'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-3.5 gap-y-6 sm:grid-cols-3 md:grid-cols-5">
            {curatedSeries.map((item, i) => (
              <ComicCard key={item.slug} item={item} index={i} />
            ))}
          </div>
        </section>

        {/* 7-Day Free Ticket Check-In Banner */}
        <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#00dc64] via-[#00e676] to-[#69f0ae] p-5 text-zinc-950 shadow-sm md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white shadow-sm">
                <TicketBadgeIcon className="size-8" />
              </div>
              <div>
                <span className="rounded bg-zinc-950 px-2 py-0.5 text-[10px] font-black text-[#00dc64]">
                  เช็กอินรับตั๋วอ่านฟรี 7 วัน
                </span>
                <h2 className="mt-1 text-xl font-black md:text-2xl">
                  เช็กอินวันที่ 1–6 รับ 1 ตั๋ว • พิเศษวันที่ 7 รับ 3 ตั๋วอ่านฟรี!
                </h2>
                <p className="text-xs font-bold text-zinc-900/80">
                  ความคืบหน้ารอบนี้: วันที่ {completedCycleDays}/7 • ตั๋วอ่านฟรีคงเหลือ {state.freePassTickets} ใบ
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPromoModal(true)}
                className="rounded-full bg-white px-5 py-2.5 text-xs font-black text-zinc-950 shadow-sm hover:bg-zinc-50"
              >
                {checkedInToday ? 'เช็กอินวันนี้แล้ว ✓' : `เช็กอินรับ +${nextTicketReward} ตั๋ว`}
              </button>
              <Link
                href="/ai-discover"
                className="rounded-full bg-zinc-950 px-4 py-2.5 text-xs font-black text-white"
              >
                ✨ AI แนะนำเรื่อง
              </Link>
            </div>
          </div>
        </section>

        {/* Continue Reading Card */}
        {lastReadSeries && (
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-zinc-200">
                  {lastReadSeries.coverUrl && (
                    <img
                      src={lastReadSeries.coverUrl}
                      alt={lastReadSeries.title}
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-black text-[#00a84b]">อ่านต่อจากที่ค้างไว้</p>
                  <h3 className="text-base font-black text-zinc-950">{lastReadSeries.title}</h3>
                  <p className="text-xs text-zinc-500">
                    Ep.{lastRead?.chapterNumber ?? 1} • อ่านไปแล้ว {lastRead?.percent ?? 50}%
                  </p>
                </div>
              </div>
              <Link
                href={`/read/${encodeURIComponent(lastReadSeries.slug)}/${lastRead?.chapterNumber ?? 1}`}
                className="rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-black text-white hover:bg-zinc-800"
              >
                ดำเนินอ่านต่อ →
              </Link>
            </div>
          </section>
        )}

        {/* Popular Ranking Preview */}
        <section>
          <SectionTitle title="อันดับยอดนิยมประจำวัน" href="/ranking" />
          <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white px-4">
            {seriesList.slice(0, 6).map((item, idx) => (
              <Link
                key={item.slug}
                href={`/series/${encodeURIComponent(item.slug)}`}
                className="flex items-center gap-4 py-3.5 hover:bg-zinc-50/70"
              >
                <span className="w-6 text-center text-lg font-black text-zinc-900">{idx + 1}</span>
                <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                  {item.coverUrl && (
                    <img
                      src={item.coverUrl}
                      alt={item.title}
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-sm text-zinc-950">{item.title}</b>
                  <p className="text-xs text-zinc-400">
                    {GENRE_THAI_MAP[item.genres[0] || 'action'] || 'แอ็กชัน'} • โดย {item.author}
                  </p>
                </div>
                <div className="text-right text-xs font-bold text-[#00c75a]">
                  ♥ {formatLikesShort(item.slug, item.rating)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* 7-Day Free Ticket Check-In Modal */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl bg-zinc-900 p-7 text-center text-white shadow-2xl">
            <button
              type="button"
              onClick={() => setShowPromoModal(false)}
              className="absolute right-4 top-4 text-xs font-bold text-white/60 hover:text-white"
            >
              ปิด ✕
            </button>
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-500/20">
              <TicketBadgeIcon className="size-10" />
            </div>
            <h3 className="mt-3 text-xl font-black">เช็กอินสะสมตั๋วอ่านฟรี 7 วัน</h3>
            <p className="mt-1 text-xs text-white/65">
              วันที่ 1–6 รับวันละ 1 ตั๋ว • วันที่ 7 รับโบนัส 3 ตั๋วอ่านฟรี!
            </p>

            <div className="mt-5 grid grid-cols-4 gap-1.5 text-center text-[10px] font-black sm:grid-cols-7">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const done = day <= completedCycleDays
                const isTodayTarget = !checkedInToday && day === nextCycleDay
                return (
                  <div
                    key={day}
                    className={`rounded-xl border p-2 ${
                      day === 7 ? 'col-span-2 sm:col-span-1' : ''
                    } ${
                      done
                        ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                        : isTodayTarget
                          ? 'border-[#00dc64] bg-[#00dc64] text-zinc-950'
                          : 'border-white/15 bg-white/5 text-white/70'
                    }`}
                  >
                    <span className="block text-[9px] opacity-80">D{day}</span>
                    <b className="mt-1 block text-sm">+{day === 7 ? 3 : 1}</b>
                    <span className="block text-[9px]">ตั๋ว</span>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={handleDailyCheckin}
              disabled={checkedInToday}
              className="mt-6 w-full rounded-full bg-[#00dc64] py-3.5 text-sm font-black text-zinc-950 disabled:opacity-60"
            >
              {checkedInToday
                ? 'เช็กอินรับตั๋ววันนี้แล้ว ✓'
                : `กดเช็กอินวันนี้ รับ +${nextTicketReward} ตั๋วอ่านฟรี!`}
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

/**
 * Screenshot #5 Inspired Daily Schedule & Category Segmented View (`/schedule`)
 */
export function SchedulePage({ initialSeries }: { initialSeries?: ComicSeriesRecord[] }) {
  const {
    seriesList,
    state,
    searchQuery,
    setSearchQuery,
    authenticated,
    authUser,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
  } = useNivatoonDatabase(initialSeries)

  const [topTab, setTopTab] = useState<'daily' | 'genre'>('daily')
  const [selectedDay, setSelectedDay] = useState<string>('ศุกร์')
  const [selectedGenre, setSelectedGenre] = useState<string>('all')

  const visible = useMemo(() => {
    if (topTab === 'genre') {
      return selectedGenre === 'all'
        ? seriesList
        : seriesList.filter((s) => s.genres.includes(selectedGenre))
    }
    if (selectedDay === 'จบบริบูรณ์') {
      return seriesList.filter((s) => s.status === 'completed')
    }
    const dayMatches = seriesList.filter((s) =>
      s.updateDay.includes(selectedDay.replace('พฤหัส', 'พฤหัสบดี')),
    )
    return dayMatches.length > 0 ? dayMatches : seriesList
  }, [seriesList, topTab, selectedDay, selectedGenre])

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <Header
        coinBalance={state.coinBalance}
        freePassTickets={state.freePassTickets}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        authenticated={authenticated}
        role={authUser?.role ?? 'user'}
        displayName={authUser?.displayName || state.displayName}
        avatarUrl={authUser?.avatarUrl || state.avatarUrl}
        avatarFrame={authUser?.avatarFrame || state.avatarFrame}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        onMarkNotificationsRead={() => void markNotificationsRead()}
      />

      <main className="mx-auto min-h-[75vh] max-w-[1280px] px-3 py-5 pb-24 sm:px-4 sm:py-6 md:pb-6 lg:px-8">
        {/* Top Segmented Tabs + Trophy Ranking Button */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-6 text-xl font-black md:text-2xl">
            <button
              type="button"
              onClick={() => setTopTab('daily')}
              className={topTab === 'daily' ? 'text-zinc-950' : 'text-zinc-300'}
            >
              ประจำวัน
            </button>
            <button
              type="button"
              onClick={() => setTopTab('genre')}
              className={topTab === 'genre' ? 'text-zinc-950' : 'text-zinc-300'}
            >
              หมวดหมู่
            </button>
          </div>
          <Link
            href="/ranking"
            aria-label="จัดอันดับ"
            className="grid size-10 place-items-center rounded-full border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
          >
            <Icon name="trophy" className="size-5" />
          </Link>
        </div>

        {/* Sub-filter Strip */}
        {topTab === 'daily' ? (
          <div className="mt-3 flex gap-2 overflow-x-auto border-b border-zinc-100 pb-3">
            {SCHEDULE_TABS.map((day) => (
              <button
                type="button"
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`shrink-0 border-b-2 px-3 py-1.5 text-sm font-bold transition ${
                  selectedDay === day
                    ? 'border-zinc-950 font-black text-zinc-950'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2 pb-3">
            {GENRE_FILTERS.map((g) => (
              <button
                type="button"
                key={g.key}
                onClick={() => setSelectedGenre(g.key)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                  selectedGenre === g.key
                    ? 'bg-zinc-950 text-white'
                    : 'border border-zinc-200 bg-white text-zinc-600'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
          <span>{visible.length} เรื่อง</span>
          <span>อัปเดตล่าสุด</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
          {visible.map((item, i) => (
            <ComicCard key={item.slug} item={item} index={i} />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}

/**
 * Screenshot #7 Inspired Rankings Screen (`/ranking`)
 */
export function RankingPage({ initialSeries }: { initialSeries?: ComicSeriesRecord[] }) {
  const {
    seriesList,
    state,
    searchQuery,
    setSearchQuery,
    authenticated,
    authUser,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
  } = useNivatoonDatabase(initialSeries)

  const [tab, setTab] = useState<'hot' | 'popular' | 'romance' | 'fantasy' | 'drama' | 'action'>(
    'hot',
  )

  const ranked = useMemo(() => {
    const filtered = seriesList.filter((s) => {
      if (tab === 'romance') return s.genres.includes('romance')
      if (tab === 'fantasy') return s.genres.includes('fantasy')
      if (tab === 'drama') return s.genres.includes('drama')
      if (tab === 'action') return s.genres.includes('action')
      return true
    })
    return [...filtered].sort((a, b) =>
      tab === 'popular' ? b.episodes.length - a.episodes.length : b.rating - a.rating,
    )
  }, [seriesList, tab])

  const topOne = ranked[0]

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <Header
        coinBalance={state.coinBalance}
        freePassTickets={state.freePassTickets}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        authenticated={authenticated}
        role={authUser?.role ?? 'user'}
        displayName={authUser?.displayName || state.displayName}
        avatarUrl={authUser?.avatarUrl || state.avatarUrl}
        avatarFrame={authUser?.avatarFrame || state.avatarFrame}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        onMarkNotificationsRead={() => void markNotificationsRead()}
      />
      <main className="mx-auto min-h-[75vh] max-w-[960px] px-3 py-6 pb-24 sm:px-4 sm:py-8 md:pb-8">
        <div className="flex items-center gap-3">
          <Link href="/schedule" className="text-zinc-500 hover:text-zinc-950">
            ←
          </Link>
          <h1 className="text-2xl font-black">อันดับ ออริจินัล</h1>
        </div>

        <div className="mt-5 flex gap-4 overflow-x-auto border-b border-zinc-200 pb-3 text-sm font-bold">
          {[
            ['hot', 'กำลังฮอต'],
            ['popular', 'ยอดนิยม'],
            ['romance', 'โรแมนซ์'],
            ['fantasy', 'โรแมนซ์แฟนตาซี'],
            ['drama', 'ดราม่า'],
            ['action', 'แอ็กชัน'],
          ].map(([k, label]) => (
            <button
              type="button"
              key={k}
              onClick={() => setTab(k as any)}
              className={`shrink-0 border-b-2 pb-1.5 ${
                tab === k
                  ? 'border-zinc-950 font-black text-zinc-950'
                  : 'border-transparent text-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* #1 Featured Row (Matching Screenshot #7) */}
        {topOne && (
          <Link
            href={`/series/${encodeURIComponent(topOne.slug)}`}
            className="mt-5 flex gap-4 border-b border-zinc-100 pb-5"
          >
            <div className="relative w-28 shrink-0 overflow-hidden rounded-xl bg-zinc-200">
              {topOne.coverUrl && (
                <img src={topOne.coverUrl} alt={topOne.title} className="aspect-[3/4] size-full object-cover" />
              )}
              <span className="absolute bottom-1 left-2 text-3xl font-black text-white drop-shadow">
                1
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#00c75a]">▲ 23</span>
                <span className="text-xs text-zinc-400">
                  {GENRE_THAI_MAP[topOne.genres[0] || 'action'] || 'แอ็กชัน'}
                </span>
              </div>
              <h2 className="mt-1 text-lg font-black text-zinc-950">{topOne.title}</h2>
              <p className="mt-1 text-xs font-bold text-[#00c75a]">
                ♥ {formatLikesShort(topOne.slug, topOne.rating)}
              </p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">
                {topOne.synopsis}
              </p>
            </div>
          </Link>
        )}

        <div className="divide-y divide-zinc-100">
          {ranked.slice(1).map((item, idx) => (
            <Link
              key={item.slug}
              href={`/series/${encodeURIComponent(item.slug)}`}
              className="flex items-center gap-4 py-3.5 hover:bg-zinc-50"
            >
              <div className="w-8 text-center">
                <span className="block text-base font-black text-zinc-900">{idx + 2}</span>
                <span className="text-[10px] font-bold text-[#00c75a]">▲ {idx + 3}</span>
              </div>
              <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                {item.coverUrl && (
                  <img src={item.coverUrl} alt={item.title} className="size-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm text-zinc-950">{item.title}</b>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {GENRE_THAI_MAP[item.genres[0] || 'action'] || 'แอ็กชัน'} •{' '}
                  <span className="text-[#00c75a]">♥ {formatLikesShort(item.slug, item.rating)}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}

/**
 * Screenshot #3 Inspired Search & Category Explorer (`/discover`)
 */
export function ListingPage({
  path,
  initialSeries,
}: {
  path: string
  initialSeries?: ComicSeriesRecord[]
}) {
  const {
    seriesList,
    state,
    searchQuery,
    setSearchQuery,
    authenticated,
    authUser,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
  } = useNivatoonDatabase(initialSeries)

  const [selectedGenre, setSelectedGenre] = useState<string>('all')
  const [originFilter, setOriginFilter] = useState<string>('all')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const qParam = q.get('q')
    const gParam = q.get('genre')
    if (qParam) setSearchQuery(qParam)
    if (gParam) setSelectedGenre(gParam)
  }, [setSearchQuery])

  const filteredSeries = useMemo(() => {
    return seriesList.filter((item) => {
      if (path === 'korean' || originFilter === 'korea') {
        if (item.origin !== 'korea') return false
      }
      if (path === 'chinese' || originFilter === 'china') {
        if (item.origin !== 'china') return false
      }
      if (path === 'japanese' || originFilter === 'japan') {
        if (item.origin !== 'japan') return false
      }
      if (path === 'completed' && item.status !== 'completed') return false
      if (path === 'genres/action' && !item.genres.includes('action')) return false
      if (path === 'genres/romance' && !item.genres.includes('romance')) return false

      if (selectedGenre !== 'all' && !item.genres.includes(selectedGenre)) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          item.title.toLowerCase().includes(q) ||
          item.sub.toLowerCase().includes(q) ||
          item.author.toLowerCase().includes(q) ||
          item.synopsis.toLowerCase().includes(q) ||
          item.genres.some((g) => g.includes(q) || (GENRE_THAI_MAP[g] || '').includes(q))
        )
      }
      return true
    })
  }, [seriesList, path, selectedGenre, originFilter, searchQuery])

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <Header
        coinBalance={state.coinBalance}
        freePassTickets={state.freePassTickets}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        authenticated={authenticated}
        role={authUser?.role ?? 'user'}
        displayName={authUser?.displayName || state.displayName}
        avatarUrl={authUser?.avatarUrl || state.avatarUrl}
        avatarFrame={authUser?.avatarFrame || state.avatarFrame}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        onMarkNotificationsRead={() => void markNotificationsRead()}
      />

      <main className="mx-auto min-h-[75vh] max-w-[1280px] px-3 py-6 pb-24 sm:px-4 sm:py-8 md:pb-8 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black md:text-3xl">ค้นหา</h1>
          <Link
            href="/ai-discover"
            className="flex items-center gap-1.5 rounded-full bg-[#00dc64]/15 px-3.5 py-1.5 text-xs font-black text-[#009944]"
          >
            <Icon name="sparkles" className="size-3.5" />
            ให้ AI ช่วยหาเรื่องที่ตรงฟีล
          </Link>
        </div>

        {/* Rounded Webtoon Search Input */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-zinc-100 px-4 py-3.5">
          <Icon name="search" className="size-5 text-zinc-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ลองหาเรื่อง, ครีเอเตอร์, หมวดหมู่ และอื่นๆ"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-zinc-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-zinc-400"
            >
              ล้าง
            </button>
          )}
        </div>

        {/* Genre & Origin Filter Chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {GENRE_FILTERS.map((g) => (
            <button
              type="button"
              key={g.key}
              onClick={() => setSelectedGenre(g.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                selectedGenre === g.key
                  ? 'bg-zinc-950 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-600'
              }`}
            >
              {g.label}
            </button>
          ))}
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="ml-auto rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-700"
          >
            <option value="all">ทุกประเทศ</option>
            <option value="korea">เกาหลี (Manhwa)</option>
            <option value="china">จีน (Manhua)</option>
            <option value="japan">ญี่ปุ่น (Manga)</option>
          </select>
        </div>

        {/* Results Grid */}
        <section className="mt-7">
          <h2 className="mb-4 text-base font-black text-zinc-950">
            {searchQuery || selectedGenre !== 'all'
              ? `ผลการค้นหา (${filteredSeries.length} เรื่อง)`
              : 'เรื่องที่ทุกคนกำลังตามหา'}
          </h2>
          {filteredSeries.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-10 text-center text-sm text-zinc-500">
              ไม่พบเรื่องที่ตรงกับคำค้นหา — ลองเปลี่ยนหมวดหมู่หรือกดใช้ AI ค้นหาตามฟีล
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
              {filteredSeries.map((item, i) => (
                <ComicCard key={item.slug} item={item} index={i} />
              ))}
            </div>
          )}
        </section>

        {/* Category Tiles (Matching Screenshot #3 "ดูหมวดหมู่") */}
        <section className="mt-12">
          <h2 className="mb-4 text-base font-black text-zinc-950">ดูหมวดหมู่</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {[
              { label: 'ออริจินัลยอดนิยม', href: '/ranking', img: seriesList[0]?.coverUrl },
              { label: 'CANVAS ยอดนิยม', href: '/canvas', img: seriesList[1]?.coverUrl },
              { label: 'เรื่องใหม่', href: '/latest', img: seriesList[2]?.coverUrl },
              { label: 'ประจำวัน', href: '/schedule', img: seriesList[3]?.coverUrl },
              { label: 'แอ็กชันมันส์ๆ', href: '/discover?genre=action', img: seriesList[5]?.coverUrl },
              { label: 'โรแมนซ์แฟนตาซี', href: '/discover?genre=romance', img: seriesList[9]?.coverUrl },
            ].map((cat) => (
              <Link
                key={cat.label}
                href={cat.href}
                className="flex items-center justify-between overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-50 p-3.5 transition hover:border-zinc-400"
              >
                <b className="text-sm text-zinc-900">{cat.label}</b>
                <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-zinc-200">
                  {cat.img && <img src={cat.img} alt="" className="size-full object-cover" />}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export function CanvasPage({ initialSeries }: { initialSeries?: ComicSeriesRecord[] }) {
  const {
    seriesList,
    state,
    searchQuery,
    setSearchQuery,
    authenticated,
    authUser,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
  } = useNivatoonDatabase(initialSeries)

  const canUpload = authUser?.role === 'creator' || authUser?.role === 'admin'

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <Header
        coinBalance={state.coinBalance}
        freePassTickets={state.freePassTickets}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        authenticated={authenticated}
        role={authUser?.role ?? 'user'}
        displayName={authUser?.displayName || state.displayName}
        avatarUrl={authUser?.avatarUrl || state.avatarUrl}
        avatarFrame={authUser?.avatarFrame || state.avatarFrame}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        onMarkNotificationsRead={() => void markNotificationsRead()}
      />
      <main className="mx-auto min-h-[75vh] max-w-[1280px] px-3 py-6 pb-24 sm:px-4 sm:py-8 md:pb-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-zinc-950 p-7 text-white">
          <div>
            <span className="rounded bg-[#00dc64] px-2.5 py-0.5 text-[11px] font-black text-white">
              NIVATOON CANVAS
            </span>
            <h1 className="mt-2 text-3xl font-black">พื้นที่ปล่อยของสำหรับครีเอเตอร์อิสระ</h1>
            <p className="mt-1 text-sm text-white/70">
              อ่านผลงานจากนักวาดหน้าใหม่ หรือยื่นขอสิทธิ์เป็นครีเอเตอร์เพื่อลงเรื่องของคุณเอง
            </p>
          </div>
          {canUpload ? (
            <Link
              href="/studio"
              className="rounded-full bg-[#00dc64] px-6 py-3 text-sm font-black text-white"
            >
              + เปิด Studio อัพผลงาน
            </Link>
          ) : (
            <Link
              href={authenticated ? '/profile' : '/login'}
              className="rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-bold text-white"
            >
              {authenticated ? 'ขอสิทธิ์ลงผลงานในหน้าบัญชี →' : 'เข้าสู่ระบบเพื่อขอสิทธิ์ครีเอเตอร์'}
            </Link>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-3.5 gap-y-6 sm:grid-cols-3 md:grid-cols-5">
          {seriesList.map((item, i) => (
            <ComicCard key={item.slug} item={item} index={i} />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export function AiDiscoverPage({ initialSeries }: { initialSeries?: ComicSeriesRecord[] }) {
  const {
    seriesList,
    state,
    searchQuery,
    setSearchQuery,
    authenticated,
    authUser,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
  } = useNivatoonDatabase(initialSeries)

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<
    Array<{ slug: string; matchScore: number; reasonThai: string }>
  >([])

  const runSearch = async (text: string) => {
    if (!text.trim()) return
    setQuery(text)
    setLoading(true)
    try {
      const res = await fetch('/api/ai/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      })
      const data = await res.json()
      if (!data.configured) {
        const lower = text.toLowerCase()
        const picks = seriesList
          .filter(
            (s) =>
              s.title.toLowerCase().includes(lower) ||
              s.synopsis.toLowerCase().includes(lower) ||
              s.genres.some((g) => lower.includes(g)),
          )
          .slice(0, 4)
        const finalPicks = picks.length > 0 ? picks : seriesList.slice(0, 4)
        setResults(
          finalPicks.map((m, idx) => ({
            slug: m.slug,
            matchScore: 95 - idx * 5,
            reasonThai: m.synopsis,
          })),
        )
      } else {
        setResults(data.recommendations || [])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <Header
        coinBalance={state.coinBalance}
        freePassTickets={state.freePassTickets}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        authenticated={authenticated}
        role={authUser?.role ?? 'user'}
        displayName={authUser?.displayName || state.displayName}
        avatarUrl={authUser?.avatarUrl || state.avatarUrl}
        avatarFrame={authUser?.avatarFrame || state.avatarFrame}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        onMarkNotificationsRead={() => void markNotificationsRead()}
      />
      <main className="mx-auto min-h-[75vh] max-w-[960px] px-3 py-6 pb-24 sm:px-4 sm:py-10 md:pb-10">
        <span className="rounded-full bg-[#00dc64]/15 px-3 py-1 text-xs font-black text-[#009944]">
          AI MATCHMAKER
        </span>
        <h1 className="mt-3 text-3xl font-black md:text-4xl">บอกฟีลเรื่องที่อยากอ่าน</h1>
        <p className="mt-2 text-sm text-zinc-500">
          พิมพ์แนวเรื่อง นิสัยพระเอก/นางเอก หรือฉากที่ชอบ AI จะคัดเรื่องที่ตรงใจที่สุดให้ทันที
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void runSearch(query)
          }}
          className="mt-6 flex flex-col gap-2 sm:flex-row"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="เช่น อยากอ่านแนวพระเอกมีระบบเทพ หรือโรแมนซ์ชิงบัลลังก์ในวัง..."
            className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-sm outline-none focus:border-[#00dc64] focus:bg-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[#00dc64] px-7 py-3.5 text-sm font-black text-white"
          >
            {loading ? 'กำลังค้นหา...' : 'ค้นหาเลย'}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            'พระเอกมีระบบเทพ',
            'นางเอกสายโหด ชิงไหวชิงพริบ',
            'คอมเมดี้ จบแล้ว อ่านรวดเดียว',
            'ไซเบอร์พังก์ ล่าวิญญาณ',
          ].map((preset) => (
            <button
              type="button"
              key={preset}
              onClick={() => void runSearch(preset)}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-xs font-bold hover:border-[#00dc64]"
            >
              ✨ {preset}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-4">
          {results.map((rec) => {
            const item = seriesList.find((s) => s.slug === rec.slug)
            if (!item) return null
            return (
              <Link
                key={rec.slug}
                href={`/series/${encodeURIComponent(item.slug)}`}
                className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-4 hover:border-[#00dc64]"
              >
                <div className="w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                  {item.coverUrl && (
                    <img src={item.coverUrl} alt={item.title} className="aspect-[3/4] size-full object-cover" />
                  )}
                </div>
                <div className="flex-1">
                  <span className="rounded bg-[#00dc64] px-2 py-0.5 text-[10px] font-black text-white">
                    ตรงใจ {rec.matchScore}%
                  </span>
                  <h3 className="mt-1.5 text-lg font-black">{item.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-600">
                    {rec.reasonThai}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </main>
      <Footer />
    </div>
  )
}
