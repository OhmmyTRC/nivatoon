'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CoinBadgeIcon, Icon, TicketBadgeIcon } from './icons'
import { ComicCard, Footer, formatLikesShort, Header } from './chrome'
import { useNivatoonDatabase } from './store'
import {
  type ComicSeriesRecord,
  generateChaptersForSeries,
  STARTER_SERIES,
} from '@/lib/database'

const GENRE_THAI: Record<string, string> = {
  action: 'แอ็กชัน',
  fantasy: 'แฟนตาซี',
  romance: 'โรแมนซ์',
  drama: 'ดราม่า',
  comedy: 'คอมเมดี้',
  historical: 'ย้อนยุค',
}

/**
 * Screenshot #2 Inspired Series Detail Page (`/series/[slug]`)
 * Clean consumer layout with 3 tabs: ตัวอย่างในตอน | ตอน | เรื่องที่คล้ายกัน
 * Zero internal folder/database debug info.
 */
export function SeriesPage({
  initialSeries,
  slug = 'moonlit-sword',
}: {
  initialSeries?: ComicSeriesRecord[]
  slug?: string
}) {
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
  const router = useRouter()

  const decodedSlug = (() => {
    try {
      return decodeURIComponent(slug)
    } catch {
      return slug
    }
  })()

  const series =
    seriesList.find((s) => s.slug === decodedSlug || s.folder === decodedSlug) ??
    STARTER_SERIES.find((s) => s.slug === decodedSlug) ??
    seriesList[0]

  const [activeTab, setActiveTab] = useState<'preview' | 'episodes' | 'similar'>('episodes')
  const [sortOldestFirst, setSortOldestFirst] = useState(true)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [copiedMsg, setCopiedMsg] = useState(false)
  const [loreInput, setLoreInput] = useState('')
  const [loreAnswer, setLoreAnswer] = useState<string | null>(null)
  const [loreLoading, setLoreLoading] = useState(false)

  const chapters = useMemo(() => {
    const base = generateChaptersForSeries(series)
    return base.sort((a, b) =>
      sortOldestFirst ? a.chapterNumber - b.chapterNumber : b.chapterNumber - a.chapterNumber,
    )
  }, [series, sortOldestFirst])

  const similarSeries = useMemo(() => {
    const shared = seriesList.filter(
      (s) => s.slug !== series.slug && s.genres.some((g) => series.genres.includes(g)),
    )
    return (shared.length > 0 ? shared : seriesList.filter((s) => s.slug !== series.slug)).slice(
      0,
      6,
    )
  }, [seriesList, series])

  const inLibrary = state.librarySlugs.includes(series.slug)
  const userStar = state.userRatings[series.slug] ?? 0
  const historyItem = state.readingHistory.find((h) => h.seriesSlug === series.slug)
  const previewPages = chapters[0]?.pages?.slice(0, 2) ?? []

  const handleToggleLibrary = () => {
    updateState(
      (prev) => {
        const exists = prev.librarySlugs.includes(series.slug)
        return {
          ...prev,
          librarySlugs: exists
            ? prev.librarySlugs.filter((s) => s !== series.slug)
            : [...prev.librarySlugs, series.slug],
        }
      },
      'toggle_library',
      { seriesSlug: series.slug },
    )
  }

  const handleOpenChapter = (
    chNum: number,
    coinPrice: number,
    chId: string,
    useFreePass = false,
  ) => {
    const isUnlocked =
      coinPrice === 0 ||
      state.plan === 'plus' ||
      state.unlockedChapterIds.includes(chId)

    if (!isUnlocked) {
      if (useFreePass) {
        if (state.freePassTickets <= 0) return
        updateState(
          (prev) => ({
            ...prev,
            freePassTickets: prev.freePassTickets - 1,
            unlockedChapterIds: [...prev.unlockedChapterIds, chId],
          }),
          'unlock_chapter',
          { seriesSlug: series.slug, chapterNumber: chNum, chapterId: chId, useFreePass: true },
        )
      } else {
        if (state.coinBalance < coinPrice) {
          router.push('/wallet/topup')
          return
        }
        updateState(
          (prev) => ({
            ...prev,
            coinBalance: prev.coinBalance - coinPrice,
            unlockedChapterIds: [...prev.unlockedChapterIds, chId],
          }),
          'unlock_chapter',
          {
            seriesSlug: series.slug,
            chapterNumber: chNum,
            chapterId: chId,
            coinPrice,
            useFreePass: false,
          },
        )
      }
    }

    router.push(`/read/${encodeURIComponent(series.slug)}/${chNum}`)
  }

  const handleAskSeriesLore = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loreInput.trim()) return
    setLoreLoading(true)
    try {
      const res = await fetch('/api/ai/recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesSlug: series.slug,
          currentChapter: historyItem?.chapterNumber ?? 2,
          question: loreInput.trim(),
        }),
      })
      const data = await res.json()
      setLoreAnswer(data.configured ? data.text : series.synopsis)
    } finally {
      setLoreLoading(false)
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

      <main className="mx-auto max-w-[960px] pb-24 md:pb-16">
        {/* Top Action Bar (Screenshot #2 inspired) */}
        <div className="flex items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid size-9 place-items-center rounded-full hover:bg-zinc-100"
            aria-label="ย้อนกลับ"
          >
            ←
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleLibrary}
              className={`rounded-full px-4 py-1.5 text-xs font-black transition ${
                inLibrary
                  ? 'bg-[#00dc64] text-white'
                  : 'border border-zinc-300 bg-white text-zinc-900'
              }`}
            >
              {inLibrary ? '✓ กำลังติดตาม' : '+ ติดตาม'}
            </button>
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="grid size-8 place-items-center rounded-full border border-zinc-200 text-xs font-black text-zinc-600"
              aria-label="ข้อมูลเรื่อง"
            >
              i
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href).catch(() => {})
                setCopiedMsg(true)
                setTimeout(() => setCopiedMsg(false), 2000)
              }}
              className="grid size-8 place-items-center rounded-full border border-zinc-200 text-xs font-black text-zinc-600"
              aria-label="แชร์"
            >
              ⋮
            </button>
          </div>
        </div>

        {copiedMsg && (
          <div className="mx-4 mb-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-center text-xs font-bold text-white">
            คัดลอกลิงก์แชร์เรื่องเรียบร้อยแล้ว ✓
          </div>
        )}

        {/* Series Header Block */}
        <section className="flex flex-col items-center gap-5 px-4 text-center sm:flex-row sm:items-start sm:text-left">
          <div className="w-36 shrink-0 overflow-hidden rounded-2xl bg-zinc-200 shadow-md sm:w-44">
            {series.coverUrl && (
              <img
                src={series.coverUrl}
                alt={series.title}
                className="aspect-[3/4] size-full object-cover"
              />
            )}
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-[#00a84b]">
              อันดับยอดนิยม • {GENRE_THAI[series.genres[0] || 'action'] || 'แอ็กชัน'}
            </p>
            <h1 className="mt-1 text-2xl font-black text-zinc-950 md:text-3xl">
              {series.title}
            </h1>
            <p className="mt-1 text-sm font-medium text-zinc-500">
              {series.author} • อัปเดตทุกวัน{series.updateDay}
            </p>

            <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-600">
              {series.synopsis}
            </p>

            {/* Clickable Genre Pills */}
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {series.genres.map((g) => (
                <Link
                  key={g}
                  href={`/discover?genre=${encodeURIComponent(g)}`}
                  className="rounded-md bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-600 hover:bg-zinc-200"
                >
                  {GENRE_THAI[g] || g}
                </Link>
              ))}
              <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-[#00a84b]">
                ♥ {formatLikesShort(series.slug, series.rating)}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
              <Link
                href={`/read/${encodeURIComponent(series.slug)}/${historyItem?.chapterNumber ?? 1}`}
                className="flex items-center gap-1.5 rounded-full bg-[#00dc64] px-6 py-2.5 text-sm font-black text-white shadow-sm"
              >
                <Icon name="play" className="size-4" />
                {historyItem ? `อ่านต่อ Ep.${historyItem.chapterNumber}` : 'อ่านตอนแรก Ep.1'}
              </Link>

              {/* Star Rating Bar */}
              <div className="flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() =>
                      updateState(
                        (prev) => ({
                          ...prev,
                          userRatings: { ...prev.userRatings, [series.slug]: star },
                        }),
                        'rate_series',
                        { seriesSlug: series.slug, stars: star },
                      )
                    }
                    className={`text-sm ${
                      star <= userStar ? 'text-amber-400' : 'text-zinc-300 hover:text-amber-300'
                    }`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-1 text-xs font-bold text-zinc-500">
                  {series.rating.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Tab Underline Navigation (Screenshot #2: ตัวอย่างในตอน | ตอน | เรื่องที่คล้ายกัน) */}
        <div className="mt-8 grid grid-cols-3 border-b border-zinc-200 text-center text-sm font-bold">
          {[
            ['preview', 'ตัวอย่างในตอน'],
            ['episodes', `ตอน (${chapters.length})`],
            ['similar', 'เรื่องที่คล้ายกัน'],
          ].map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`border-b-2 py-3.5 transition ${
                activeTab === key
                  ? 'border-zinc-950 font-black text-zinc-950'
                  : 'border-transparent text-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'episodes' && (
          <section className="px-4 pt-4">
            <div className="flex items-center justify-between py-2 text-xs font-bold text-zinc-500">
              <span>ทั้งหมด {chapters.length} ตอน</span>
              <button
                type="button"
                onClick={() => setSortOldestFirst((v) => !v)}
                className="flex items-center gap-1 text-zinc-700"
              >
                {sortOldestFirst ? 'เก่าที่สุด ↑↓' : 'ล่าสุด ↑↓'}
              </button>
            </div>

            <div className="divide-y divide-zinc-100">
              {chapters.map((ch) => {
                const isUnlocked =
                  ch.coinPrice === 0 ||
                  state.plan === 'plus' ||
                  state.unlockedChapterIds.includes(ch.id)
                const thumb = ch.pages[0] ?? series.coverUrl

                return (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between gap-2 py-3 sm:gap-3"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenChapter(ch.chapterNumber, ch.coinPrice, ch.id)
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-3.5"
                    >
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 sm:h-14 sm:w-20">
                        {thumb && (
                          <img
                            src={thumb}
                            alt={`Ep.${ch.chapterNumber}`}
                            className="size-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <b className="block truncate text-sm font-bold text-zinc-900">
                          Ep.{ch.chapterNumber}
                        </b>
                        <p className="line-clamp-1 text-xs text-zinc-400">
                          {ch.title} • {ch.publishedAt}
                        </p>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                      {!isUnlocked && state.freePassTickets > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenChapter(ch.chapterNumber, ch.coinPrice, ch.id, true)
                          }
                          className="flex items-center gap-1 rounded-full border border-[#00dc64] px-3 py-1 text-[11px] font-black text-[#00a84b]"
                        >
                          <TicketBadgeIcon className="size-3.5" /> อ่านฟรี
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenChapter(ch.chapterNumber, ch.coinPrice, ch.id)
                        }
                        className={
                          isUnlocked
                            ? 'rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50'
                            : 'flex items-center gap-1.5 rounded-full bg-zinc-950 px-3.5 py-1.5 text-xs font-black text-amber-300'
                        }
                      >
                        {isUnlocked ? (
                          'อ่าน'
                        ) : (
                          <>
                            <CoinBadgeIcon className="size-3.5" /> {ch.coinPrice}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {activeTab === 'preview' && (
          <section className="space-y-6 px-4 pt-6">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <b className="text-sm font-black">ถาม AI เกี่ยวกับเรื่องนี้ (ไม่สปอยล์)</b>
              <form onSubmit={handleAskSeriesLore} className="mt-3 flex gap-2">
                <input
                  value={loreInput}
                  onChange={(e) => setLoreInput(e.target.value)}
                  placeholder="ถามเรื่องแนวเรื่อง ตัวละคร หรือพล็อตหลัก..."
                  className="flex-1 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-[#00dc64]"
                />
                <button
                  type="submit"
                  disabled={loreLoading}
                  className="rounded-xl bg-[#00dc64] px-4 py-2.5 text-xs font-black text-white"
                >
                  {loreLoading ? 'กำลังตอบ...' : 'ถาม'}
                </button>
              </form>
              {loreAnswer && (
                <p className="mt-3 whitespace-pre-line text-xs leading-6 text-zinc-700">
                  {loreAnswer}
                </p>
              )}
            </div>

            {previewPages.length > 0 && (
              <div className="mx-auto max-w-md space-y-2 overflow-hidden rounded-2xl border border-zinc-200">
                {previewPages.map((p, idx) => (
                  <img key={p} src={p} alt={`ตัวอย่างหน้าที่ ${idx + 1}`} className="w-full" />
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'similar' && (
          <section className="grid grid-cols-2 gap-3.5 px-4 pt-6 sm:grid-cols-3 md:grid-cols-5">
            {similarSeries.map((s, i) => (
              <ComicCard key={s.slug} item={s} index={i} />
            ))}
          </section>
        )}
      </main>

      {/* Series Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <b className="text-lg font-black">{series.title}</b>
              <button type="button" onClick={() => setShowInfoModal(false)}>
                ✕
              </button>
            </div>
            <p className="mt-3 text-xs leading-6 text-zinc-600">{series.synopsis}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3 text-xs">
              <div>
                <span className="text-zinc-400">ผู้สร้าง</span>
                <b className="mt-0.5 block">{series.author}</b>
              </div>
              <div>
                <span className="text-zinc-400">สถานะ</span>
                <b className="mt-0.5 block">
                  {series.status === 'completed' ? 'จบบริบูรณ์' : `อัปเดตทุกวัน${series.updateDay}`}
                </b>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

/**
 * Role-Protected Creator Studio (`/studio`)
 * Strictly visible only to `creator` and `admin` roles!
 */
export function StudioPage({ initialSeries }: { initialSeries?: ComicSeriesRecord[] }) {
  const {
    seriesList,
    refreshSeries,
    state,
    searchQuery,
    setSearchQuery,
    authenticated,
    authUser,
    authLoaded,
    latestCreatorRequest,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
    refreshAuth,
  } = useNivatoonDatabase(initialSeries)

  const [folder, setFolder] = useState('')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [origin, setOrigin] = useState<'korea' | 'china' | 'japan'>('korea')
  const [synopsis, setSynopsis] = useState('')
  const [episodeDir, setEpisodeDir] = useState('ep-01')
  const [episodeTitle, setEpisodeTitle] = useState('')
  const [coinPrice, setCoinPrice] = useState(0)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [pageFiles, setPageFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)

  const [artPrompt, setArtPrompt] = useState('')
  const [artLoading, setArtLoading] = useState(false)
  const [artPreview, setArtPreview] = useState<string | null>(null)
  const [artMessage, setArtMessage] = useState<string | null>(null)

  // Creator Request fields when regular `user` visits /studio
  const [penName, setPenName] = useState('')
  const [sampleTitle, setSampleTitle] = useState('')
  const [portfolioNote, setPortfolioNote] = useState('')
  const [reqMsg, setReqMsg] = useState<string | null>(null)

  useEffect(() => {
    if (authUser?.displayName && !author) {
      setAuthor(authUser.displayName)
    }
  }, [authUser, author])

  const isCreatorOrAdmin = authUser?.role === 'creator' || authUser?.role === 'admin'

  const handleRequestCreator = async (e: React.FormEvent) => {
    e.preventDefault()
    setReqMsg(null)
    const res = await fetch('/api/creator-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ penName, sampleTitle, portfolioNote }),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) {
      setReqMsg(data.error || 'ส่งคำขอไม่สำเร็จ')
      return
    }
    setReqMsg('ส่งคำขอสิทธิ์ผู้อัพผลงานเรียบร้อยแล้ว! กรุณารอแอดมินอนุมัติ')
    await refreshAuth()
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetFolder = folder.trim() || title.trim().toLowerCase().replace(/\s+/g, '-')
    if (!targetFolder) return
    setUploading(true)
    setUploadStatus(null)
    try {
      const fd = new FormData()
      fd.set('folder', targetFolder)
      if (title) fd.set('title', title)
      if (author) fd.set('author', author)
      fd.set('origin', origin)
      if (synopsis) fd.set('synopsis', synopsis)
      fd.set('episodeDir', episodeDir)
      if (episodeTitle) fd.set('episodeTitle', episodeTitle)
      fd.set('coinPrice', String(coinPrice))
      if (coverFile) fd.set('cover', coverFile)
      for (const f of pageFiles) fd.append('pages', f)

      const res = await fetch('/api/studio/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed')

      setUploadStatus(
        `อัปโหลดตอนใหม่สำเร็จ (${data.savedPages.length} หน้า)! พร้อมอ่านบนแพลตฟอร์มแล้ว`,
      )
      setPageFiles([])
      await refreshSeries()
    } catch (err: any) {
      setUploadStatus(`เกิดข้อผิดพลาด: ${err?.message || 'Error'}`)
    } finally {
      setUploading(false)
    }
  }

  const handleGenerateArt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!artPrompt.trim()) return
    setArtLoading(true)
    setArtMessage(null)
    try {
      const targetFolder = folder.trim() || title.trim().toLowerCase().replace(/\s+/g, '-')
      const res = await fetch('/api/ai/generate-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: artPrompt,
          saveToFolder: targetFolder || undefined,
          saveAs: 'cover',
        }),
      })
      const data = await res.json()
      if (!data.configured) {
        setArtMessage('ระบบสร้างภาพ AI ยังไม่พร้อมใช้งานในขณะนี้')
        return
      }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed')
      if (data.imageBase64) setArtPreview(`data:image/jpeg;base64,${data.imageBase64}`)
      setArtMessage('สร้างภาพปกเรียบร้อยแล้ว!')
      await refreshSeries()
    } catch (err: any) {
      setArtMessage(`ผิดพลาด: ${err?.message || 'Error'}`)
    } finally {
      setArtLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8f9] text-zinc-950">
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

      <main className="mx-auto min-h-[75vh] max-w-[1100px] px-3 py-6 pb-24 sm:px-4 sm:py-10 md:pb-10">
        {!authLoaded ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-zinc-500">
            กำลังตรวจสอบสิทธิ์บัญชี...
          </div>
        ) : !authenticated ? (
          <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center">
            <h1 className="text-2xl font-black">เข้าสู่ระบบ Creator Studio</h1>
            <p className="mt-2 text-sm text-zinc-500">
              กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับสิทธิ์ครีเอเตอร์ก่อนลงผลงาน
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-full bg-[#00dc64] px-7 py-3 text-sm font-black text-white"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        ) : !isCreatorOrAdmin ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-8">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
              จำกัดสิทธิ์เฉพาะครีเอเตอร์
            </span>
            <h1 className="mt-3 text-2xl font-black">ยังไม่มีสิทธิ์อัปโหลดผลงาน</h1>
            <p className="mt-2 text-sm text-zinc-500">
              บัญชีนักอ่านทั่วไปต้องส่งคำขอและรอแอดมินอนุมัติก่อนจึงจะใช้งาน Creator Studio ได้
            </p>

            {authUser?.creatorStatus === 'pending' ? (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                ⏳ คำขอของคุณ ({latestCreatorRequest?.sample_title || 'ผลงานใหม่'}) กำลังรอแอดมินตรวจสอบ
              </div>
            ) : (
              <form onSubmit={handleRequestCreator} className="mt-6 space-y-3.5">
                {reqMsg && (
                  <div className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                    {reqMsg}
                  </div>
                )}
                <input
                  value={penName}
                  onChange={(e) => setPenName(e.target.value)}
                  placeholder="นามปากกา / ชื่อสตูดิโอ"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                  required
                />
                <input
                  value={sampleTitle}
                  onChange={(e) => setSampleTitle(e.target.value)}
                  placeholder="ชื่อเรื่องที่ต้องการลงเผยแพร่"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                  required
                />
                <textarea
                  rows={3}
                  value={portfolioNote}
                  onChange={(e) => setPortfolioNote(e.target.value)}
                  placeholder="แนะนำผลงานหรือแนวเรื่องคร่าวๆ..."
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#00dc64] py-3.5 text-sm font-black text-white"
                >
                  ส่งคำขอสิทธิ์ลงผลงานให้แอดมินอนุมัติ
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-zinc-950 p-7 text-white">
              <div>
                <span className="rounded bg-[#00dc64] px-2.5 py-0.5 text-[11px] font-black text-white">
                  CREATOR STUDIO
                </span>
                <h1 className="mt-2 text-3xl font-black">เผยแพร่เรื่องและตอนใหม่</h1>
                <p className="mt-1 text-sm text-white/70">
                  สร้างเรื่องใหม่หรือเพิ่มตอนให้อัพเดตขึ้นหน้าแอปทันที
                </p>
              </div>
              <Link
                href="/canvas"
                className="rounded-full border border-white/25 px-5 py-2.5 text-xs font-bold"
              >
                ดูผลงานบน CANVAS
              </Link>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <form
                onSubmit={handleUploadSubmit}
                className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6"
              >
                <h2 className="text-xl font-black">อัพโหลดเรื่องและตอนใหม่</h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold">
                    ชื่อเรื่อง
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
                      placeholder="เช่น ดาบมังกรข้ามมิติ"
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold">
                    รหัสเรื่อง (ภาษาอังกฤษสำหรับ URL)
                    <input
                      value={folder}
                      onChange={(e) => setFolder(e.target.value)}
                      className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
                      placeholder="dragon-dimension"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="grid gap-1 text-xs font-bold">
                    ตอนที่ (เช่น ep-01)
                    <input
                      value={episodeDir}
                      onChange={(e) => setEpisodeDir(e.target.value)}
                      className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold">
                    ชื่อตอน
                    <input
                      value={episodeTitle}
                      onChange={(e) => setEpisodeTitle(e.target.value)}
                      className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
                      placeholder="ตอนที่ 1 จุดเริ่มต้น"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold">
                    ราคาเหรียญ (0 = ฟรี)
                    <input
                      type="number"
                      min={0}
                      value={coinPrice}
                      onChange={(e) => setCoinPrice(Number(e.target.value))}
                      className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold">
                    นามปากกา / สตูดิโอ
                    <input
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold">
                    หมวดประเทศ
                    <select
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value as any)}
                      className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm"
                    >
                      <option value="korea">เกาหลี (Manhwa)</option>
                      <option value="china">จีน (Manhua)</option>
                      <option value="japan">ญี่ปุ่น (Manga)</option>
                    </select>
                  </label>
                </div>

                <label className="grid gap-1 text-xs font-bold">
                  เรื่องย่อ
                  <textarea
                    rows={2}
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    className="rounded-xl border border-zinc-200 px-3.5 py-2 text-sm"
                    placeholder="คำโปรยสั้นๆ เพื่อดึงดูดผู้อ่าน..."
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold">
                    รูปปกเรื่อง
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                      className="rounded-xl border border-dashed border-zinc-300 p-2.5 text-xs"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold">
                    ภาพหน้าตอน (เลือกหลายไฟล์พร้อมกัน)
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setPageFiles(Array.from(e.target.files ?? []))}
                      className="rounded-xl border border-dashed border-zinc-300 p-2.5 text-xs"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full rounded-xl bg-[#00dc64] py-3.5 text-sm font-black text-white"
                >
                  {uploading ? 'กำลังเผยแพร่...' : 'เผยแพร่ตอนใหม่'}
                </button>

                {uploadStatus && (
                  <p className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                    {uploadStatus}
                  </p>
                )}
              </form>

              <form
                onSubmit={handleGenerateArt}
                className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6"
              >
                <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[10px] font-black text-[#00dc64]">
                  AI COVER ASSISTANT
                </span>
                <h2 className="text-xl font-black">ช่วยออกแบบภาพปกเรื่อง</h2>
                <textarea
                  rows={4}
                  value={artPrompt}
                  onChange={(e) => setArtPrompt(e.target.value)}
                  placeholder="บรรยายตัวละครหรือฉากปกที่ต้องการ เช่น Female mage holding glowing crystal sword..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={artLoading}
                  className="w-full rounded-xl bg-zinc-950 py-3 text-sm font-black text-white"
                >
                  {artLoading ? 'กำลังสร้างภาพ...' : 'สร้างภาพปกด้วย AI'}
                </button>
                {artMessage && <p className="text-xs font-bold text-zinc-600">{artMessage}</p>}
                {artPreview && (
                  <img
                    src={artPreview}
                    alt="AI Cover Preview"
                    className="mx-auto max-h-64 rounded-xl border border-zinc-200 object-contain"
                  />
                )}
              </form>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h3 className="text-lg font-black">ผลงานที่เผยแพร่แล้ว ({seriesList.length} เรื่อง)</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {seriesList.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/series/${encodeURIComponent(s.slug)}`}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 hover:border-[#00dc64]"
                  >
                    <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                      {s.coverUrl && (
                        <img src={s.coverUrl} alt="" className="size-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <b className="block truncate text-sm">{s.title}</b>
                      <span className="text-xs text-zinc-400">
                        {s.episodes?.length || s.latestChapter} ตอน
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
