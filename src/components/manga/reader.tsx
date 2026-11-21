'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'
import { useNivatoonDatabase } from './store'
import {
  type ComicSeriesRecord,
  type EpisodeCommentRecord,
  generateChaptersForSeries,
  STARTER_SERIES,
} from '@/lib/database'
import type { TranslatedBubble } from '@/lib/gemini'

interface PanelTranslationState {
  loading?: boolean
  configured?: boolean
  error?: string
  detectedLanguage?: string
  summary?: string
  bubbles?: TranslatedBubble[]
  showOverlay?: boolean
}

export function ReaderPage({
  initialSeries,
  slug = 'moonlit-sword',
  chapterNumber = 1,
}: {
  initialSeries?: ComicSeriesRecord[]
  slug?: string
  chapterNumber?: number
}) {
  const { seriesList, state, updateState, aiConfigured } = useNivatoonDatabase(initialSeries)
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

  const chapters = useMemo(
    () => generateChaptersForSeries(series).sort((a, b) => a.chapterNumber - b.chapterNumber),
    [series],
  )
  const currentChapter =
    chapters.find((c) => c.chapterNumber === chapterNumber) ?? chapters[0]
  const episodeId = currentChapter?.id ?? `${series.slug}-ep-${chapterNumber}`
  const pages = currentChapter?.pages ?? []

  // Reader settings & HUD states (Better than Webtoon!)
  const [hudVisible, setHudVisible] = useState(true)
  const [readingMode, setReadingMode] = useState<'scroll' | 'page-ltr' | 'page-rtl'>('scroll')
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [scrollPercent, setScrollPercent] = useState(0)
  const [autoScroll, setAutoScroll] = useState(false)
  const [scrollSpeed, setScrollSpeed] = useState(1.5)
  const [brightness, setBrightness] = useState(100)
  const [eyeCare, setEyeCare] = useState<'normal' | 'sepia' | 'dim'>('normal')
  const [panelWidth, setPanelWidth] = useState<'narrow' | 'standard' | 'wide'>('standard')
  const [seamlessGap, setSeamlessGap] = useState(true)

  // Drawers
  const [showSettings, setShowSettings] = useState(false)
  const [showEpisodeList, setShowEpisodeList] = useState(false)
  const [showAiCompanion, setShowAiCompanion] = useState(false)

  // Ambient Web Audio BGM
  const [bgmPlaying, setBgmPlaying] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const bgmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Gemini AI Panel Translator state keyed by page URL
  const [translations, setTranslations] = useState<Record<string, PanelTranslationState>>({})

  // Gemini AI Spoiler-Free Recap & Lore Companion
  const [recapMessages, setRecapMessages] = useState<
    Array<{ role: 'user' | 'ai'; text: string }>
  >([])
  const [recapInteractionId, setRecapInteractionId] = useState<string | null>(null)
  const [recapQuestion, setRecapQuestion] = useState('')
  const [recapLoading, setRecapLoading] = useState(false)

  // Gemini AI Voice Drama TTS
  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsResult, setTtsResult] = useState<{
    audioDataUrl: string | null
    script: Array<{ speaker: string; text: string }>
    error?: string
  } | null>(null)

  // Comments & Spoilers (synced with SQLite /api/comments)
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({})
  const [dbComments, setDbComments] = useState<EpisodeCommentRecord[]>([])

  const isLiked = state.likedEpisodeIds.includes(episodeId)
  const reactions = state.episodeReactions[episodeId] ?? {
    hype: 120,
    emotional: 45,
    funny: 18,
    shocked: 64,
  }

  useEffect(() => {
    fetch(
      `/api/comments?seriesSlug=${encodeURIComponent(series.slug)}&chapterNumber=${chapterNumber}`,
      { cache: 'no-store' },
    )
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.comments)) {
          setDbComments(
            d.comments.map((c: any) => ({
              id: c.id,
              seriesSlug: c.series_slug,
              chapterNumber: c.chapter_number,
              author: c.author_name,
              avatarBadge: c.author_badge || 'READER',
              text: c.body,
              likes: c.likes,
              isTop: Boolean(c.is_top),
              isSpoiler: Boolean(c.is_spoiler),
              createdAt: c.created_at?.slice(0, 10) || 'ล่าสุด',
            })),
          )
        }
      })
      .catch(() => {})

    fetch('/api/user-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'track_view', seriesSlug: series.slug }),
    }).catch(() => {})
  }, [series.slug, chapterNumber])

  const episodeComments = useMemo(() => {
    if (dbComments.length > 0) return dbComments
    return state.comments.filter(
      (c) => c.seriesSlug === series.slug && c.chapterNumber === chapterNumber,
    )
  }, [dbComments, state.comments, series.slug, chapterNumber])

  const currentIdx = chapters.findIndex((c) => c.chapterNumber === chapterNumber)
  const prevEp = currentIdx > 0 ? chapters[currentIdx - 1] : null
  const nextEp = currentIdx >= 0 && currentIdx < chapters.length - 1 ? chapters[currentIdx + 1] : null

  // Save initial reading history entry & track real scroll percentage
  useEffect(() => {
    const handleScroll = () => {
      const doc = document.documentElement
      const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight)
      const pct = Math.min(100, Math.max(5, Math.round((window.scrollY / scrollable) * 100)))
      setScrollPercent(pct)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const pct = readingMode === 'scroll' ? scrollPercent : Math.round(((currentPageIndex + 1) / Math.max(1, pages.length)) * 100)
    const timer = setTimeout(() => {
      updateState(
        (prev) => {
          const filtered = prev.readingHistory.filter((h) => h.seriesSlug !== series.slug)
          return {
            ...prev,
            readingHistory: [
              {
                seriesSlug: series.slug,
                chapterNumber,
                percent: Math.max(10, pct),
                page: currentPageIndex + 1,
                updatedAt: 'เมื่อสักครู่',
              },
              ...filtered,
            ],
          }
        },
        'save_reading_progress',
        { seriesSlug: series.slug, chapterNumber, percent: Math.max(10, pct) },
      )
    }, 600)
    return () => clearTimeout(timer)
  }, [series.slug, chapterNumber, scrollPercent, currentPageIndex, readingMode, pages.length])

  // Auto-scroll loop
  useEffect(() => {
    if (!autoScroll || readingMode !== 'scroll') return
    let rafId = 0
    const step = () => {
      window.scrollBy(0, scrollSpeed)
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        setAutoScroll(false)
        return
      }
      rafId = requestAnimationFrame(step)
    }
    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [autoScroll, scrollSpeed, readingMode])

  // Keyboard shortcuts (Space scroll / Arrows page flip)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (readingMode !== 'scroll') {
        if (e.key === 'ArrowRight') {
          setCurrentPageIndex((p) =>
            readingMode === 'page-ltr'
              ? Math.min(Math.max(0, pages.length - 1), p + 1)
              : Math.max(0, p - 1),
          )
        } else if (e.key === 'ArrowLeft') {
          setCurrentPageIndex((p) =>
            readingMode === 'page-ltr'
              ? Math.max(0, p - 1)
              : Math.min(Math.max(0, pages.length - 1), p + 1),
          )
        }
      } else if (e.key === ' ') {
        e.preventDefault()
        setAutoScroll((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [readingMode, pages.length])

  // Synthesized ambient BGM cleanup
  useEffect(() => {
    return () => {
      if (bgmIntervalRef.current) clearInterval(bgmIntervalRef.current)
      audioCtxRef.current?.close().catch(() => {})
    }
  }, [])

  const toggleBgm = () => {
    if (bgmPlaying) {
      if (bgmIntervalRef.current) clearInterval(bgmIntervalRef.current)
      audioCtxRef.current?.close().catch(() => {})
      audioCtxRef.current = null
      setBgmPlaying(false)
      return
    }
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new Ctx()
      audioCtxRef.current = ctx
      const notes = [220, 261.63, 329.63, 392.0, 293.66]
      let idx = 0
      const playNote = () => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = notes[idx % notes.length]
        idx += 1
        gain.gain.setValueAtTime(0.001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.6)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.4)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 2.5)
      }
      playNote()
      bgmIntervalRef.current = setInterval(playNote, 2400)
      setBgmPlaying(true)
    } catch {
      setBgmPlaying(false)
    }
  }

  // Gemini AI Panel Translate
  const handleTranslatePanel = async (imageUrl: string) => {
    setTranslations((prev) => ({
      ...prev,
      [imageUrl]: { ...prev[imageUrl], loading: true, error: undefined },
    }))
    try {
      const res = await fetch('/api/ai/translate-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          seriesTitle: series.title,
          chapterNumber,
        }),
      })
      const data = await res.json()
      if (!data.configured) {
        setTranslations((prev) => ({
          ...prev,
          [imageUrl]: {
            loading: false,
            configured: false,
            error:
              'ระบบ AI แปลภาพพร้อมใช้งานเมื่อเชื่อมต่อ API — ขณะนี้กำลังแสดงโหมดอ่านปกติ',
          },
        }))
        return
      }
      if (!data.ok) throw new Error(data.error || 'Translation failed')
      setTranslations((prev) => ({
        ...prev,
        [imageUrl]: {
          loading: false,
          configured: true,
          detectedLanguage: data.detectedLanguage,
          summary: data.summary,
          bubbles: data.bubbles,
          showOverlay: true,
        },
      }))
    } catch (err: any) {
      setTranslations((prev) => ({
        ...prev,
        [imageUrl]: {
          loading: false,
          error: err?.message || 'ไม่สามารถแปลภาพได้ในขณะนี้',
        },
      }))
    }
  }

  // Gemini AI Voice Drama TTS
  const handleGenerateVoiceDrama = async () => {
    const activeUrl = pages[currentPageIndex] ?? pages[0]
    setTtsLoading(true)
    setTtsResult(null)
    try {
      const res = await fetch('/api/ai/voice-drama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: activeUrl,
          seriesTitle: series.title,
          chapterNumber,
          fallbackText: `${series.title} ตอนที่ ${chapterNumber}: ${series.synopsis}`,
        }),
      })
      const data = await res.json()
      if (!data.configured) {
        setTtsResult({
          audioDataUrl: null,
          script: [],
          error: 'ระบบ AI พากย์เสียงยังไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่อีกครั้งภายหลัง',
        })
        return
      }
      if (!data.ok) throw new Error(data.error || 'Voice generation failed')
      const audioDataUrl = data.audioBase64
        ? `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`
        : null
      setTtsResult({ audioDataUrl, script: data.script || [] })
    } catch (err: any) {
      setTtsResult({
        audioDataUrl: null,
        script: [],
        error: err?.message || 'สร้างเสียงพากย์ไม่สำเร็จ',
      })
    } finally {
      setTtsLoading(false)
    }
  }

  // Gemini AI Spoiler-Free Recap & Q&A
  const handleAskRecap = async (customQuestion?: string) => {
    const q = (customQuestion ?? recapQuestion).trim()
    setRecapLoading(true)
    if (q) {
      setRecapMessages((prev) => [...prev, { role: 'user', text: q }])
      setRecapQuestion('')
    }
    try {
      const res = await fetch('/api/ai/recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesSlug: series.slug,
          currentChapter: chapterNumber,
          question: q || undefined,
          previousInteractionId: recapInteractionId || undefined,
        }),
      })
      const data = await res.json()
      if (!data.configured) {
        setRecapMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            text: `📖 สรุปเนื้อเรื่อง (ถึงตอนที่ ${Math.max(1, chapterNumber - 1)}):\n\n${series.synopsis}`,
          },
        ])
        return
      }
      if (data.interactionId) setRecapInteractionId(data.interactionId)
      setRecapMessages((prev) => [
        ...prev,
        { role: 'ai', text: data.text || 'ไม่สามารถสร้างบทสรุปได้' },
      ])
    } catch (err: any) {
      setRecapMessages((prev) => [
        ...prev,
        { role: 'ai', text: `เกิดข้อผิดพลาด: ${err?.message || 'Error'}` },
      ])
    } finally {
      setRecapLoading(false)
    }
  }

  // Comment submit synced with SQLite DB + Gemini Decisions API Spoiler Guard
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || commentSubmitting) return
    setCommentSubmitting(true)
    const text = commentText.trim()
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesSlug: series.slug,
          seriesTitle: series.title,
          chapterNumber,
          body: text,
          authorName: state.displayName,
        }),
      })
      const data = await res.json()
      if (data?.ok && data?.comment) {
        const c = data.comment
        const created: EpisodeCommentRecord = {
          id: c.id,
          seriesSlug: c.series_slug,
          chapterNumber: c.chapter_number,
          author: c.author_name,
          avatarBadge: c.author_badge || 'READER',
          text: c.body,
          likes: c.likes,
          isTop: Boolean(c.is_top),
          isSpoiler: Boolean(c.is_spoiler),
          createdAt: 'เมื่อสักครู่',
        }
        setDbComments((prev) => [created, ...prev])
        updateState((prev) => ({
          ...prev,
          comments: [created, ...prev.comments],
        }))
      }
    } catch {}
    setCommentText('')
    setCommentSubmitting(false)
  }

  const handleNavigateChapter = (targetNum: number, price: number, id: string) => {
    const unlocked =
      price === 0 || state.plan === 'plus' || state.unlockedChapterIds.includes(id)
    if (!unlocked) {
      if (state.coinBalance < price) {
        router.push('/wallet/topup')
        return
      }
      updateState(
        (prev) => ({
          ...prev,
          coinBalance: prev.coinBalance - price,
          unlockedChapterIds: [...prev.unlockedChapterIds, id],
        }),
        'unlock_chapter',
        { seriesSlug: series.slug, chapterNumber: targetNum, chapterId: id, coinPrice: price },
      )
    }
    setShowEpisodeList(false)
    setCurrentPageIndex(0)
    router.push(`/read/${encodeURIComponent(series.slug)}/${targetNum}`)
  }

  const maxWClass =
    panelWidth === 'narrow'
      ? 'max-w-[560px]'
      : panelWidth === 'wide'
        ? 'max-w-[920px]'
        : 'max-w-[720px]'

  const filterStyle: React.CSSProperties = {
    filter: `brightness(${brightness}%) ${
      eyeCare === 'sepia' ? 'sepia(32%) contrast(95%)' : eyeCare === 'dim' ? 'contrast(88%)' : ''
    }`,
  }

  return (
    <main className="min-h-screen bg-[#0c0d0f] pb-28 text-white">
      {/* Top Floating HUD */}
      <header
        className={`fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[#0e1013]/92 backdrop-blur transition-transform duration-200 ${
          hudVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4">
          <Link
            href={`/series/${encodeURIComponent(series.slug)}`}
            aria-label="กลับหน้ารายละเอียด"
            className="grid size-9 shrink-0 place-items-center border border-white/15 bg-white/5"
          >
            <Icon name="close" className="size-4" />
          </Link>

          <div className="min-w-0">
            <b className="block truncate text-sm md:text-base">{series.title}</b>
            <p className="truncate text-[11px] text-white/55">
              ตอนที่ {chapterNumber}
              {currentChapter?.title ? ` — ${currentChapter.title}` : ''} •{' '}
              {readingMode === 'scroll'
                ? `${scrollPercent}%`
                : `หน้า ${currentPageIndex + 1}/${Math.max(1, pages.length)}`}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAiCompanion(true)
                if (recapMessages.length === 0) void handleAskRecap()
              }}
              className="flex items-center gap-1.5 rounded-full bg-[#b9ff66] px-3 py-1.5 text-xs font-black text-black"
            >
              <Icon name="sparkles" className="size-3.5" />
              <span className="hidden sm:inline">AI Recap &amp; Lore</span>
            </button>

            <button
              type="button"
              onClick={() => setShowEpisodeList(true)}
              className="border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold"
            >
              ตอน ({chapters.length})
            </button>

            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              aria-label="ตั้งค่าการอ่าน"
              className="grid size-9 place-items-center border border-white/15 bg-white/5"
            >
              <Icon name="settings" className="size-4" />
            </button>
          </div>
        </div>

        {/* Reading progress hairline */}
        <div className="h-0.5 w-full bg-white/10">
          <div
            className="h-full bg-[#b9ff66] transition-all"
            style={{
              width: `${
                readingMode === 'scroll'
                  ? scrollPercent
                  : Math.round(((currentPageIndex + 1) / Math.max(1, pages.length)) * 100)
              }%`,
            }}
          />
        </div>
      </header>

      {/* Reader Settings Popover */}
      {showSettings && (
        <div className="fixed right-4 top-20 z-40 w-80 border border-white/15 bg-[#15181c] p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <b className="text-sm">ตั้งค่าตัวอ่าน Pro (Webtoon+)</b>
            <button type="button" onClick={() => setShowSettings(false)}>
              <Icon name="close" className="size-4" />
            </button>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            <div>
              <p className="mb-1.5 font-bold text-white/60">โหมดการอ่าน</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ['scroll', 'แนวตั้งยาว'],
                  ['page-ltr', 'ทีละหน้า LTR'],
                  ['page-rtl', 'มังงะ RTL'],
                ].map(([m, label]) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setReadingMode(m as any)}
                    className={`py-2 font-bold ${
                      readingMode === m
                        ? 'bg-[#b9ff66] text-black'
                        : 'border border-white/15 bg-white/5 text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between font-bold text-white/60">
                <span>ความสว่างหน้าจอ</span>
                <span>{brightness}%</span>
              </div>
              <input
                type="range"
                min={45}
                max={100}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full accent-[#b9ff66]"
              />
            </div>

            <div>
              <p className="mb-1.5 font-bold text-white/60">โทนถนอมสายตา</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ['normal', 'ปกติ'],
                  ['sepia', 'ถนอมสายตา'],
                  ['dim', 'มืดนุ่ม'],
                ].map(([mode, label]) => (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => setEyeCare(mode as any)}
                    className={`py-2 font-bold ${
                      eyeCare === mode
                        ? 'bg-[#b9ff66] text-black'
                        : 'border border-white/15 bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 font-bold text-white/60">ความกว้างหน้ากระดาษ</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ['narrow', '560px'],
                  ['standard', '720px'],
                  ['wide', '920px'],
                ].map(([w, label]) => (
                  <button
                    type="button"
                    key={w}
                    onClick={() => setPanelWidth(w as any)}
                    className={`py-2 font-bold ${
                      panelWidth === w
                        ? 'bg-[#b9ff66] text-black'
                        : 'border border-white/15 bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {readingMode === 'scroll' && (
              <div>
                <div className="mb-1 flex justify-between font-bold text-white/60">
                  <span>ความเร็ว Auto-Scroll</span>
                  <span>{scrollSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={4}
                  step={0.5}
                  value={scrollSpeed}
                  onChange={(e) => setScrollSpeed(Number(e.target.value))}
                  className="w-full accent-[#b9ff66]"
                />
                <label className="mt-3 flex items-center justify-between">
                  <span>ต่อช่องไร้รอยต่อ (0px Gap)</span>
                  <input
                    type="checkbox"
                    checked={seamlessGap}
                    onChange={(e) => setSeamlessGap(e.target.checked)}
                    className="accent-[#b9ff66]"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Reader Canvas */}
      <div
        className={`mx-auto pt-16 ${maxWClass}`}
        style={filterStyle}
        onClick={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('button, a, input, textarea, audio')) return
          setHudVisible((v) => !v)
        }}
      >
        {/* Episode Title Card */}
        <div className="border-b border-white/10 bg-gradient-to-b from-[#171b22] to-[#0c0d0f] px-6 py-10 text-center">
          <p className="text-[11px] font-black uppercase tracking-[.35em] text-[#b9ff66]">
            {series.sub} • EPISODE {String(chapterNumber).padStart(2, '0')}
          </p>
          <h1 className="mt-2 text-2xl font-black md:text-3xl">
            {currentChapter?.title || `ตอนที่ ${chapterNumber}`}
          </h1>
          <p className="mt-2 text-xs text-white/50">
            ตอนที่ {chapterNumber} • {pages.length} หน้า • แตะพื้นที่ว่างเพื่อซ่อนแถบเมนู
          </p>
        </div>

        {/* Voice Drama Audio Player Bar if active */}
        {(ttsLoading || ttsResult) && (
          <div className="sticky top-16 z-20 border-b border-[#b9ff66]/30 bg-[#131915] p-4">
            {ttsLoading ? (
              <p className="text-xs font-bold text-[#00dc64]">
                🎙️ AI กำลังอ่านภาพและพากย์เสียงตัวละคร...
              </p>
            ) : ttsResult?.error ? (
              <div className="flex items-center justify-between text-xs text-amber-300">
                <span>{ttsResult.error}</span>
                <button
                  type="button"
                  onClick={() => setTtsResult(null)}
                  className="underline"
                >
                  ปิด
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <b className="text-[#b9ff66]">🎙️ AI Voice Drama (Multi-Speaker TTS)</b>
                  <button
                    type="button"
                    onClick={() => setTtsResult(null)}
                    className="text-white/60 hover:text-white"
                  >
                    ปิด
                  </button>
                </div>
                {ttsResult?.audioDataUrl && (
                  <audio controls autoPlay src={ttsResult.audioDataUrl} className="h-9 w-full" />
                )}
                {ttsResult?.script && ttsResult.script.length > 0 && (
                  <div className="grid gap-1 text-xs text-white/75">
                    {ttsResult.script.map((line, i) => (
                      <p key={i}>
                        <b className="text-[#b9ff66]">{line.speaker}:</b> {line.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Comic Pages Rendering */}
        {pages.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#14161a] p-12 text-center">
            <p className="text-lg font-bold">กำลังเตรียมเนื้อหาตอนที่ {chapterNumber}</p>
            <p className="mt-2 text-sm text-white/55">
              ตอนนี้อยู่ระหว่างการอัปเดตภาพประกอบ กรุณาติดตามอัปเดตเร็วๆ นี้
            </p>
            <Link
              href={`/series/${series.slug}`}
              className="mt-5 inline-block rounded-full bg-[#00dc64] px-6 py-2.5 text-sm font-black text-slate-950"
            >
              ← กลับหน้าเรื่อง
            </Link>
          </div>
        ) : readingMode === 'scroll' ? (
          <div className={seamlessGap ? 'flex flex-col gap-0' : 'flex flex-col gap-4 py-4'}>
            {pages.map((imgUrl, idx) => {
              const tState = translations[imgUrl]
              return (
                <div key={imgUrl} className="group relative bg-black">
                  <img
                    src={imgUrl}
                    alt={`${series.title} ตอนที่ ${chapterNumber} หน้า ${idx + 1}`}
                    className="block h-auto w-full select-none"
                    loading={idx < 2 ? 'eager' : 'lazy'}
                  />

                  {/* Per-Panel Gemini AI Translate Floating Pill */}
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 opacity-95 transition md:opacity-0 md:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => void handleTranslatePanel(imgUrl)}
                      disabled={tState?.loading}
                      className="flex items-center gap-1.5 rounded-full bg-black/85 px-3 py-1.5 text-[11px] font-black text-[#b9ff66] ring-1 ring-[#b9ff66]/40 backdrop-blur"
                    >
                      <Icon name="translate" className="size-3.5" />
                      {tState?.loading ? 'กำลังแปล...' : 'AI แปลภาพนี้'}
                    </button>
                    {tState?.bubbles && tState.bubbles.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTranslations((prev) => ({
                            ...prev,
                            [imgUrl]: {
                              ...prev[imgUrl],
                              showOverlay: !prev[imgUrl]?.showOverlay,
                            },
                          }))
                        }
                        className="rounded-full bg-[#b9ff66] px-2.5 py-1.5 text-[11px] font-black text-black"
                      >
                        {tState.showOverlay ? 'ซ่อนคำแปล' : 'แสดงคำแปล'}
                      </button>
                    )}
                  </div>

                  {/* Floating Translated Thai Bubble Overlays */}
                  {tState?.showOverlay &&
                    tState.bubbles?.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          top: `${Math.min(82, Math.max(8, b.boxYPercent || 15))}%`,
                          left: `${Math.min(72, Math.max(8, b.boxXPercent || 20))}%`,
                        }}
                        className="absolute z-10 max-w-[260px] -translate-x-1/4 rounded-xl border-2 border-[#b9ff66] bg-white/95 px-3 py-2 text-xs text-black shadow-xl backdrop-blur"
                      >
                        <p className="text-[10px] font-black uppercase text-emerald-700">
                          {b.speaker} • {b.tone}
                        </p>
                        <p className="mt-0.5 font-bold leading-snug">{b.thaiTranslation}</p>
                        <p className="mt-0.5 text-[10px] text-black/45">{b.originalText}</p>
                      </div>
                    ))}

                  {/* Panel Translation Footer Summary or Error */}
                  {tState?.error && (
                    <div className="border-t border-amber-500/30 bg-amber-950/80 px-4 py-2.5 text-xs text-amber-200">
                      {tState.error}
                    </div>
                  )}
                  {tState?.summary && (
                    <div className="border-t border-emerald-500/30 bg-[#101915] px-4 py-2.5 text-xs text-emerald-100">
                      <span className="font-black text-[#b9ff66]">
                        AI ({tState.detectedLanguage}):
                      </span>{' '}
                      {tState.summary}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* Single Page Flip Mode (Manga RTL / Manhwa LTR) */
          <div className="py-4">
            <div className="relative bg-black">
              <img
                src={pages[currentPageIndex] ?? pages[0]}
                alt={`${series.title} หน้า ${currentPageIndex + 1}`}
                className="mx-auto block h-auto max-h-[82vh] w-auto max-w-full"
              />
              <button
                type="button"
                aria-label="หน้าก่อน"
                onClick={() =>
                  setCurrentPageIndex((p) =>
                    readingMode === 'page-ltr'
                      ? Math.max(0, p - 1)
                      : Math.min(pages.length - 1, p + 1),
                  )
                }
                className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize"
              />
              <button
                type="button"
                aria-label="หน้าถัดไป"
                onClick={() =>
                  setCurrentPageIndex((p) =>
                    readingMode === 'page-ltr'
                      ? Math.min(pages.length - 1, p + 1)
                      : Math.max(0, p - 1),
                  )
                }
                className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize"
              />
            </div>
            <div className="mt-4 flex items-center justify-between px-4 text-xs">
              <button
                type="button"
                onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                disabled={currentPageIndex === 0}
                className="border border-white/20 px-4 py-2 font-bold disabled:opacity-40"
              >
                ← หน้าก่อนหน้า
              </button>
              <span className="font-bold">
                หน้า {currentPageIndex + 1} / {pages.length} ({readingMode.toUpperCase()})
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPageIndex((p) => Math.min(pages.length - 1, p + 1))
                }
                disabled={currentPageIndex >= pages.length - 1}
                className="bg-[#b9ff66] px-4 py-2 font-black text-black disabled:opacity-40"
              >
                หน้าถัดไป →
              </button>
            </div>
          </div>
        )}

        {/* Episode End Engagement & Webtoon Social Bar */}
        <section className="mt-8 border-t border-white/10 bg-[#131519] p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() =>
                updateState((prev) => ({
                  ...prev,
                  likedEpisodeIds: isLiked
                    ? prev.likedEpisodeIds.filter((id) => id !== episodeId)
                    : [...prev.likedEpisodeIds, episodeId],
                }))
              }
              className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-black ${
                isLiked
                  ? 'border-rose-400 bg-rose-500/20 text-rose-300'
                  : 'border-white/20 bg-white/5 text-white'
              }`}
            >
              <Icon name="heart" className="size-4" />
              {isLiked ? 'กดใจตอนนี้แล้ว ♥' : 'กดใจตอนนี้'} ({(isLiked ? 1421 : 1420).toLocaleString()})
            </button>

            <div className="flex flex-wrap gap-2">
              {[
                ['hype', '🔥 มันส์'],
                ['emotional', '😭 ซึ้ง'],
                ['funny', '😂 ฮา'],
                ['shocked', '😱 ช็อก'],
              ].map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() =>
                    updateState((prev) => {
                      const curr = prev.episodeReactions[episodeId] ?? reactions
                      return {
                        ...prev,
                        episodeReactions: {
                          ...prev.episodeReactions,
                          [episodeId]: { ...curr, [key]: (curr[key] || 0) + 1 },
                        },
                      }
                    })
                  }
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold hover:border-[#b9ff66]"
                >
                  {label} {(reactions[key] || 0).toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Prev / Next Episode Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {prevEp ? (
              <button
                type="button"
                onClick={() =>
                  handleNavigateChapter(prevEp.chapterNumber, prevEp.coinPrice, prevEp.id)
                }
                className="border border-white/15 bg-white/5 py-3.5 text-sm font-bold hover:bg-white/10"
              >
                ← ตอนที่ {prevEp.chapterNumber}
              </button>
            ) : (
              <div className="border border-white/5 py-3.5 text-center text-sm text-white/25">
                นี่คือตอนแรกแล้ว
              </div>
            )}
            {nextEp ? (
              <button
                type="button"
                onClick={() =>
                  handleNavigateChapter(nextEp.chapterNumber, nextEp.coinPrice, nextEp.id)
                }
                className="bg-[#b9ff66] py-3.5 text-sm font-black text-black hover:opacity-90"
              >
                ตอนถัดไป (ตอนที่ {nextEp.chapterNumber}) →
              </button>
            ) : (
              <Link
                href={`/series/${encodeURIComponent(series.slug)}`}
                className="border border-[#b9ff66]/40 py-3.5 text-center text-sm font-bold text-[#b9ff66]"
              >
                อ่านครบตอนล่าสุดแล้ว • กลับหน้าเรื่อง
              </Link>
            )}
          </div>

          {/* Comments + Gemini Spoiler Guard */}
          <div className="mt-10 border-t border-white/10 pt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">
                คอมเมนต์ท้ายตอน ({episodeComments.length})
              </h2>
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#b9ff66]">
                <Icon name="shield" className="size-3.5" />
                Gemini Decision Guard กันสปอยล์อัตโนมัติ
              </span>
            </div>

            <form onSubmit={handlePostComment} className="mt-4 flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="แสดงความคิดเห็นถึงตอนนี้ (ถ้ามีสปอยล์ AI จะเบลอให้อัตโนมัติ)..."
                className="flex-1 border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#b9ff66]"
              />
              <button
                type="submit"
                disabled={commentSubmitting}
                className="bg-[#b9ff66] px-5 py-3 text-sm font-black text-black disabled:opacity-50"
              >
                {commentSubmitting ? 'กำลังตรวจ...' : 'ส่ง'}
              </button>
            </form>

            <div className="mt-6 space-y-4">
              {episodeComments.length === 0 ? (
                <p className="text-sm text-white/45">
                  ยังไม่มีคอมเมนต์ในตอนนี้ เป็นคนแรกที่ร่วมพูดคุยเลย!
                </p>
              ) : (
                episodeComments.map((c) => {
                  const isHidden = c.isSpoiler && !revealedSpoilers[c.id]
                  return (
                    <div
                      key={c.id}
                      className="border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        {c.isTop && (
                          <span className="bg-[#b9ff66] px-1.5 py-0.5 text-[10px] font-black text-black">
                            TOP
                          </span>
                        )}
                        <b className="text-white">{c.author}</b>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/65">
                          {c.avatarBadge}
                        </span>
                        {c.isSpoiler && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                            ⚠️ AI ตรวจพบสปอยล์
                          </span>
                        )}
                        <span className="ml-auto text-white/40">{c.createdAt}</span>
                      </div>

                      {isHidden ? (
                        <div className="mt-2.5 flex items-center justify-between border border-amber-500/20 bg-amber-950/30 p-3 text-xs">
                          <span className="text-amber-200/80">
                            คอมเมนต์นี้ถูกซ่อนเพื่อป้องกันสปอยล์อัตโนมัติ
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedSpoilers((prev) => ({ ...prev, [c.id]: true }))
                            }
                            className="font-bold text-[#b9ff66] underline"
                          >
                            คลิกเพื่ออ่าน
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm leading-6 text-white/85">{c.text}</p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Floating Action Dock */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0e1013]/95 px-4 py-3 backdrop-blur transition-transform duration-200 ${
          hudVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setAutoScroll((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 ${
              autoScroll
                ? 'bg-[#b9ff66] text-black'
                : 'border border-white/15 bg-white/5 text-white'
            }`}
          >
            <Icon name={autoScroll ? 'pause' : 'play'} className="size-3.5" />
            <span className="hidden sm:inline">
              {autoScroll ? 'หยุดเลื่อน' : 'Auto Scroll'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              const target = pages[0]
              if (target) void handleTranslatePanel(target)
            }}
            className="flex items-center gap-1.5 rounded-full border border-[#b9ff66]/40 bg-[#b9ff66]/10 px-3.5 py-2 text-[#b9ff66]"
          >
            <Icon name="translate" className="size-3.5" />
            <span>AI แปลหน้าแรก</span>
          </button>

          <button
            type="button"
            onClick={() => void handleGenerateVoiceDrama()}
            disabled={ttsLoading}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-2"
          >
            <Icon name="volume" className="size-3.5 text-[#b9ff66]" />
            <span className="hidden sm:inline">
              {ttsLoading ? 'กำลังสร้างเสียง...' : 'AI พากย์เสียง'}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleBgm}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 ${
              bgmPlaying
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40'
                : 'border border-white/15 bg-white/5'
            }`}
          >
            <Icon name="music" className="size-3.5" />
            <span className="hidden md:inline">BGM {bgmPlaying ? 'ON' : 'OFF'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            {prevEp && (
              <button
                type="button"
                onClick={() =>
                  handleNavigateChapter(prevEp.chapterNumber, prevEp.coinPrice, prevEp.id)
                }
                aria-label="ตอนก่อนหน้า"
                className="grid size-8 rotate-180 place-items-center border border-white/15 bg-white/5"
              >
                <Icon name="arrow" className="size-4" />
              </button>
            )}
            {nextEp && (
              <button
                type="button"
                onClick={() =>
                  handleNavigateChapter(nextEp.chapterNumber, nextEp.coinPrice, nextEp.id)
                }
                aria-label="ตอนถัดไป"
                className="grid size-8 place-items-center bg-[#b9ff66] text-black"
              >
                <Icon name="arrow" className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Slide-over Episode Drawer */}
      {showEpisodeList && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="h-full w-full max-w-sm overflow-y-auto border-l border-white/15 bg-[#121418] p-6">
            <div className="flex items-center justify-between">
              <b className="text-base">เลือกตอน — {series.title}</b>
              <button type="button" onClick={() => setShowEpisodeList(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="mt-5 divide-y divide-white/10">
              {chapters.map((ch) => {
                const active = ch.chapterNumber === chapterNumber
                return (
                  <button
                    type="button"
                    key={ch.id}
                    onClick={() => handleNavigateChapter(ch.chapterNumber, ch.coinPrice, ch.id)}
                    className={`flex w-full items-center justify-between py-3.5 text-left ${
                      active ? 'text-[#b9ff66]' : 'text-white'
                    }`}
                  >
                    <div>
                      <b className="text-sm">ตอนที่ {ch.chapterNumber}</b>
                      <p className="text-xs text-white/50">{ch.title}</p>
                    </div>
                    <span className="text-xs font-bold">
                      {ch.coinPrice === 0 ? 'ฟรี' : `${ch.coinPrice} เหรียญ`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Gemini AI Spoiler-Free Recap & Lore Companion Drawer */}
      {showAiCompanion && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-md flex-col border-l border-white/15 bg-[#121418] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-[11px] font-black tracking-[.2em] text-[#00dc64]">
                  NIVATOON AI • SPOILER-SAFE
                </p>
                <b className="text-base">AI สรุปเรื่องก่อนหน้า &amp; ถาม Lore</b>
              </div>
              <button type="button" onClick={() => setShowAiCompanion(false)}>
                <Icon name="close" />
              </button>
            </div>

            {aiConfigured === false && (
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-200">
                กำลังแสดงโหมดสรุปเนื้อหาแบบออฟไลน์ (เชื่อมต่อผู้ช่วย AI ออนไลน์อัตโนมัติเมื่อพร้อม)
              </div>
            )}

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
              {recapMessages.map((m, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-line p-3.5 leading-6 ${
                    m.role === 'user'
                      ? 'ml-8 bg-[#b9ff66] font-bold text-black'
                      : 'mr-4 border border-white/10 bg-white/5 text-white/90'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {recapLoading && (
                <div className="mr-4 border border-white/10 bg-white/5 p-3.5 text-xs text-[#b9ff66]">
                  กำลังรวบรวมข้อมูลถึงตอนที่ {Math.max(1, chapterNumber - 1)} แบบไม่สปอยล์...
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[
                  'สรุปตอนก่อนหน้าสั้นๆ',
                  'พลังหลักของตัวเอกคืออะไร?',
                  'มีตัวละครสำคัญคนไหนบ้าง?',
                ].map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => void handleAskRecap(preset)}
                    className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/75 hover:border-[#b9ff66]"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleAskRecap()
                }}
                className="flex gap-2"
              >
                <input
                  value={recapQuestion}
                  onChange={(e) => setRecapQuestion(e.target.value)}
                  placeholder="ถามเรื่องพลัง ตัวละคร หรือทวนความจำ..."
                  className="flex-1 border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-[#b9ff66]"
                />
                <button
                  type="submit"
                  disabled={recapLoading}
                  className="bg-[#b9ff66] px-4 py-2.5 text-sm font-black text-black"
                >
                  ถาม
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
