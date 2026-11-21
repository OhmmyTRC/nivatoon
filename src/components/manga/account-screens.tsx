'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FRAME_STYLES } from './chrome'
import { CoinBadgeIcon, Icon, TicketBadgeIcon } from './icons'
import { SlipPaymentCheckoutForm } from './payment-checkout'
import type {
  AppNotificationItem,
  CreatorRequestItem,
  NivatoonUserState,
  UserRole,
} from './store'
import { type ComicSeriesRecord } from '@/lib/database'
import { PLUS_PACKAGE } from '@/lib/promptpay'

const ROLE_BADGE: Record<UserRole, { label: string; cls: string }> = {
  user: { label: 'นักอ่าน (User)', cls: 'bg-zinc-100 text-zinc-700' },
  creator: { label: 'ผู้อัพผลงาน (Creator)', cls: 'bg-[#00dc64]/15 text-[#008f42]' },
  admin: { label: 'ผู้ดูแลระบบ (Admin)', cls: 'bg-zinc-950 text-[#00dc64]' },
}

const BANNER_GRADIENTS: Record<string, string> = {
  midnight: 'from-zinc-950 via-zinc-900 to-zinc-800',
  emerald: 'from-[#062815] via-[#0c3f21] to-[#125a2f]',
  amber: 'from-[#331a05] via-[#5c2f09] to-[#7c3f0d]',
  rose: 'from-[#380b1f] via-[#5e1435] to-[#831843]',
  cyber: 'from-[#0b1026] via-[#1b1f4a] to-[#0f3460]',
}

export function MyWebtoonScreen({
  initialTab,
  seriesList,
  state,
}: {
  initialTab: string
  seriesList: ComicSeriesRecord[]
  state: NivatoonUserState
}) {
  const [tab, setTab] = useState<'history' | 'library' | 'purchases'>(
    initialTab === 'library' ? 'library' : initialTab === 'purchases' ? 'purchases' : 'history',
  )

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-black sm:text-2xl">เว็บตูนของฉัน</h1>
        <div className="flex items-center gap-3 text-xs font-black">
          <span className="flex items-center gap-1 text-emerald-700">
            <TicketBadgeIcon className="size-4" /> {state.freePassTickets} ตั๋ว
          </span>
          <Link href="/wallet/topup" className="flex items-center gap-1 text-[#00a84b]">
            <CoinBadgeIcon className="size-4" /> {state.coinBalance.toLocaleString()} เหรียญ
          </Link>
        </div>
      </div>

      <div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto whitespace-nowrap border-b border-zinc-200 text-xs font-bold sm:gap-6 sm:text-sm">
        {[
          ['history', `ประวัติการอ่าน (${state.readingHistory.length})`],
          ['library', `รายการที่ติดตาม (${state.librarySlugs.length})`],
          ['purchases', `ตอนที่ซื้อแล้ว (${state.unlockedChapters.length})`],
        ].map(([k, label]) => (
          <button
            type="button"
            key={k}
            onClick={() => setTab(k as any)}
            className={`border-b-2 pb-3 ${
              tab === k ? 'border-zinc-950 font-black text-zinc-950' : 'border-transparent text-zinc-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 divide-y divide-zinc-100">
        {tab === 'history' ? (
          state.readingHistory.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-400">ยังไม่มีประวัติการอ่าน เริ่มอ่านเรื่องโปรดได้เลย</p>
          ) : (
            state.readingHistory.map((h) => {
              const series = seriesList.find((s) => s.slug === h.seriesSlug)
              if (!series) return null
              return (
                <div key={`${h.seriesSlug}-${h.chapterNumber}`} className="flex items-center justify-between gap-4 py-3.5">
                  <Link href={`/series/${encodeURIComponent(series.slug)}`} className="flex items-center gap-3.5">
                    <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                      {series.coverUrl && <img src={series.coverUrl} alt="" className="size-full object-cover" />}
                    </div>
                    <div>
                      <b className="block text-sm text-zinc-950">{series.title}</b>
                      <p className="text-xs text-zinc-400">
                        ตอนที่ {h.chapterNumber} • อ่านแล้ว {h.percent}% • {h.updatedAt}
                      </p>
                    </div>
                  </Link>
                  <Link
                    href={`/read/${encodeURIComponent(series.slug)}/${h.chapterNumber}`}
                    className="shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-center text-[11px] font-bold text-zinc-800 hover:bg-zinc-100"
                  >
                    อ่านต่อ →
                  </Link>
                </div>
              )
            })
          )
        ) : tab === 'purchases' ? (
          state.unlockedChapters.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-400">ยังไม่มีตอนที่ซื้อหรือปลดล็อกไว้</p>
          ) : (
            state.unlockedChapters.map((ch) => {
              const series = seriesList.find((s) => s.slug === ch.series_slug)
              return (
                <div key={ch.chapter_id} className="flex items-center justify-between gap-4 py-3.5">
                  <Link href={`/read/${encodeURIComponent(ch.series_slug)}/${ch.chapter_number}`} className="flex items-center gap-3.5">
                    <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                      {series?.coverUrl && <img src={series.coverUrl} alt="" className="size-full object-cover" />}
                    </div>
                    <div>
                      <b className="block text-sm text-zinc-950">{series?.title || ch.series_slug}</b>
                      <p className="text-xs text-zinc-400">
                        ตอนที่ {ch.chapter_number} • {ch.coins_paid > 0 ? `ใช้ ${ch.coins_paid} เหรียญ` : 'ใช้ตั๋วอ่านฟรี'} • {ch.unlocked_at.slice(0, 10)}
                      </p>
                    </div>
                  </Link>
                  <Link
                    href={`/read/${encodeURIComponent(ch.series_slug)}/${ch.chapter_number}`}
                    className="rounded-full bg-[#00dc64] px-4 py-2 text-xs font-black text-white"
                  >
                    เปิดอ่าน
                  </Link>
                </div>
              )
            })
          )
        ) : (
          seriesList
            .filter((s) => state.librarySlugs.includes(s.slug))
            .map((series) => (
              <div key={series.slug} className="flex items-center justify-between gap-4 py-3.5">
                <Link href={`/series/${encodeURIComponent(series.slug)}`} className="flex items-center gap-3.5">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    {series.coverUrl && <img src={series.coverUrl} alt="" className="size-full object-cover" />}
                  </div>
                  <div>
                    <b className="block text-sm text-zinc-950">{series.title}</b>
                    <p className="text-xs text-zinc-400">
                      {series.episodes?.length || series.latestChapter} ตอน • ★ {series.rating.toFixed(1)}
                    </p>
                  </div>
                </Link>
                <Link
                  href={`/read/${encodeURIComponent(series.slug)}/1`}
                  className="rounded-full bg-[#00dc64] px-4 py-2 text-xs font-black text-white"
                >
                  อ่านเลย
                </Link>
              </div>
            ))
        )}
      </div>
    </div>
  )
}

export function ProfileAndRoleHub({
  seriesList,
  authenticated,
  authUser,
  latestCreatorRequest,
  state,
  onUpdated,
  onCheckin,
}: {
  seriesList: ComicSeriesRecord[]
  authenticated: boolean
  authUser: any
  latestCreatorRequest: CreatorRequestItem | null
  state: NivatoonUserState
  onUpdated: () => Promise<void>
  onCheckin: () => void
}) {
  const router = useRouter()
  const [profileTab, setProfileTab] = useState<'edit' | 'purchased' | 'history' | 'issues'>('edit')
  const [displayName, setDisplayName] = useState(authUser?.displayName || state.displayName)
  const [bio, setBio] = useState(authUser?.bio || state.bio || '')
  const [avatarFrame, setAvatarFrame] = useState(authUser?.avatarFrame || state.avatarFrame || 'emerald')
  const [bannerTheme, setBannerTheme] = useState(authUser?.bannerTheme || state.bannerTheme || 'midnight')
  const [presetAvatarUrl, setPresetAvatarUrl] = useState(authUser?.avatarUrl || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Creator Application with 1 Real Sample Work Upload
  const [showCreatorForm, setShowCreatorForm] = useState(false)
  const [penName, setPenName] = useState('')
  const [sampleTitle, setSampleTitle] = useState('')
  const [portfolioNote, setPortfolioNote] = useState('')
  const [sampleCoverFile, setSampleCoverFile] = useState<File | null>(null)
  const [samplePageFiles, setSamplePageFiles] = useState<File[]>([])
  const [submittingCreator, setSubmittingCreator] = useState(false)
  const [reqStatusMsg, setReqStatusMsg] = useState<string | null>(null)

  useEffect(() => {
    if (authUser) {
      setDisplayName(authUser.displayName)
      setBio(authUser.bio || '')
      setAvatarFrame(authUser.avatarFrame || 'emerald')
      setBannerTheme(authUser.bannerTheme || 'midnight')
      setPresetAvatarUrl(authUser.avatarUrl || '')
    }
  }, [authUser])

  const role: UserRole = authUser?.role ?? 'user'
  const roleMeta = ROLE_BADGE[role]
  const todayKey = new Date().toISOString().slice(0, 10)
  const checkedInToday = state.lastCheckinDate === todayKey
  const completedCycleDays = state.checkinDay ?? 0
  const nextCycleDay = (completedCycleDays % 7) + 1
  const nextReward = nextCycleDay === 7 ? 3 : 1

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authenticated) {
      router.push('/login')
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.set('displayName', displayName)
      fd.set('bio', bio)
      fd.set('avatarFrame', avatarFrame)
      fd.set('bannerTheme', bannerTheme)
      if (presetAvatarUrl) fd.set('presetAvatarUrl', presetAvatarUrl)
      if (avatarFile) fd.set('avatar', avatarFile)

      const res = await fetch('/api/profile', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed')
      setAvatarFile(null)
      setMsg('อัปเดตโปรไฟล์และรูปประจำตัวเรียบร้อยแล้ว ✓')
      await onUpdated()
    } catch (err: any) {
      setMsg(`ผิดพลาด: ${err?.message || 'Error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitCreatorRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setReqStatusMsg(null)
    if (!sampleCoverFile && samplePageFiles.length === 0) {
      setReqStatusMsg('กรุณาอัปโหลดภาพปกหรือหน้าตัวอย่างผลงานอย่างน้อย 1 รูปให้แอดมินตรวจสอบ')
      return
    }
    setSubmittingCreator(true)
    try {
      const fd = new FormData()
      fd.set('penName', penName)
      fd.set('sampleTitle', sampleTitle)
      fd.set('portfolioNote', portfolioNote)
      fd.set('sampleSynopsis', portfolioNote)
      if (sampleCoverFile) fd.set('cover', sampleCoverFile)
      for (const f of samplePageFiles) fd.append('pages', f)

      const res = await fetch('/api/creator-request', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setReqStatusMsg(data.error || 'ส่งคำขอไม่สำเร็จ')
        return
      }
      setReqStatusMsg('ส่งผลงานตัวอย่างสำเร็จ! รอแอดมินเปิดตรวจผลงานเพื่ออนุมัติสิทธิ์ Creator')
      setShowCreatorForm(false)
      await onUpdated()
    } catch (err: any) {
      setReqStatusMsg(err?.message || 'ส่งคำขอไม่สำเร็จ')
    } finally {
      setSubmittingCreator(false)
    }
  }

  const previewAvatar = avatarFile
    ? URL.createObjectURL(avatarFile)
    : presetAvatarUrl || authUser?.avatarUrl || null

  return (
    <div className="space-y-6">
      {/* Top Coin + Free Ticket Strip (NO Streak Badge!) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-[11px] font-bold text-zinc-400">เหรียญคงเหลือ</p>
            <div className="mt-1 flex items-center gap-2 text-2xl font-black">
              <CoinBadgeIcon className="size-7" />
              {state.coinBalance.toLocaleString()}
            </div>
          </div>
          <div className="border-l border-zinc-200 pl-6">
            <p className="text-[11px] font-bold text-zinc-400">ตั๋วอ่านฟรี</p>
            <div className="mt-1 flex items-center gap-2 text-2xl font-black text-emerald-700">
              <TicketBadgeIcon className="size-7" />
              {state.freePassTickets} ใบ
            </div>
          </div>
        </div>
        <Link
          href="/wallet/topup"
          className="rounded-lg bg-[#00dc64] px-6 py-2.5 text-sm font-black text-white shadow-sm"
        >
          เติมเหรียญ
        </Link>
      </div>

      {/* 7-Day Daily Check-In Ticket Board */}
      <div className="rounded-2xl border border-emerald-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <TicketBadgeIcon className="size-8 shrink-0" />
            <div>
              <h2 className="text-base font-black">เช็กอินรับตั๋วอ่านฟรีรายวัน (7 วัน)</h2>
              <p className="text-xs text-zinc-500">วันที่ 1–6 รับวันละ 1 ตั๋ว • พิเศษวันที่ 7 รับ 3 ตั๋วอ่านฟรี</p>
            </div>
          </div>
          <button
            type="button"
            disabled={checkedInToday}
            onClick={onCheckin}
            className="rounded-full bg-[#00dc64] px-5 py-2.5 text-xs font-black text-white shadow-sm disabled:opacity-50"
          >
            {checkedInToday ? 'เช็กอินวันนี้แล้ว ✓' : `เช็กอินรับ +${nextReward} ตั๋ว`}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs sm:grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const claimed = day <= completedCycleDays
            const isTarget = !checkedInToday && day === nextCycleDay
            return (
              <div
                key={day}
                className={`rounded-xl border p-2 font-black sm:p-2.5 ${
                  day === 7 ? 'col-span-2 sm:col-span-1' : ''
                } ${
                  claimed
                    ? 'border-[#00dc64] bg-[#00dc64]/15 text-[#008f42]'
                    : isTarget
                      ? 'border-zinc-950 bg-zinc-950 text-[#00dc64]'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-500'
                }`}
              >
                <span className="block text-[10px]">วันที่ {day}</span>
                <b className="mt-0.5 block text-sm">+{day === 7 ? 3 : 1}</b>
                <span className="text-[10px] font-bold">ตั๋ว</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Role-Specific Action Banner */}
      {authenticated && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          {role === 'admin' ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black text-[#00dc64]">
                  ADMIN ACCESS
                </span>
                <h2 className="mt-1 text-lg font-black">ศูนย์ควบคุมแอดมินหลังบ้าน</h2>
                <p className="text-xs text-zinc-500">
                  เปิดตรวจผลงานขอสิทธิ์ครีเอเตอร์ จัดการยศ ตั้งค่า AI/SMTP ดู Log และจัดการปัญหา
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/studio" className="rounded-full border border-zinc-200 px-4 py-2.5 text-xs font-bold">
                  อัพผลงาน
                </Link>
                <Link href="/dashboard" className="rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-black text-[#00dc64]">
                  เปิด Admin Dashboard →
                </Link>
              </div>
            </div>
          ) : role === 'creator' ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="rounded-full bg-[#00dc64] px-2.5 py-0.5 text-[10px] font-black text-white">
                  CREATOR VERIFIED ✓
                </span>
                <h2 className="mt-1 text-lg font-black">คุณได้รับสิทธิ์ผู้อัพผลงานแล้ว</h2>
                <p className="text-xs text-zinc-500">สร้างเรื่องใหม่และอัปโหลดตอน JPEG ลงบน CANVAS ได้ทันที</p>
              </div>
              <Link href="/studio" className="rounded-full bg-[#00dc64] px-6 py-3 text-xs font-black text-white shadow-sm">
                + เปิด Studio อัพผลงาน
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-black text-zinc-700">
                  ขอสิทธิ์ลงผลงาน (อัปโหลด 1 เรื่องตัวอย่างให้แอดมินตรวจ)
                </span>
                <h2 className="mt-1 text-lg font-black">อยากลงผลงานมังฮวาของคุณเองไหม?</h2>
                <p className="text-xs text-zinc-500">
                  {authUser?.creatorStatus === 'pending'
                    ? `ส่งผลงานตัวอย่าง "${latestCreatorRequest?.sample_title || ''}" แล้ว — รอแอดมินเปิดตรวจและอนุมัติ`
                    : authUser?.creatorStatus === 'rejected'
                      ? 'คำขอก่อนหน้าไม่ผ่านการพิจารณา สามารถอัปโหลดผลงานใหม่เพื่อยื่นขออีกครั้งได้'
                      : 'แนบภาพปกและหน้าตัวอย่าง 1 เรื่องเพื่อให้แอดมินเปิดตรวจก่อนอนุมัติสิทธิ์ Creator'}
                </p>
              </div>
              {authUser?.creatorStatus === 'pending' ? (
                <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-800">
                  ⏳ รอแอดมินตรวจผลงาน
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreatorForm((v) => !v)}
                  className="rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-black text-white"
                >
                  ส่ง 1 ผลงานขอสิทธิ์ Creator
                </button>
              )}
            </div>
          )}

          {reqStatusMsg && (
            <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">{reqStatusMsg}</p>
          )}

          {showCreatorForm && role === 'user' && (
            <form onSubmit={handleSubmitCreatorRequest} className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={penName}
                  onChange={(e) => setPenName(e.target.value)}
                  placeholder="นามปากกา / ชื่อสตูดิโอ"
                  className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
                  required
                />
                <input
                  value={sampleTitle}
                  onChange={(e) => setSampleTitle(e.target.value)}
                  placeholder="ชื่อเรื่องผลงานตัวอย่าง (1 เรื่อง)"
                  className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
                  required
                />
              </div>
              <textarea
                rows={2}
                value={portfolioNote}
                onChange={(e) => setPortfolioNote(e.target.value)}
                placeholder="เรื่องย่อและแนวทางการอัปเดตผลงาน..."
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-bold">
                  ภาพปกผลงานตัวอย่าง (Cover)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSampleCoverFile(e.target.files?.[0] ?? null)}
                    className="rounded-xl border border-dashed border-zinc-300 p-2 text-xs"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold">
                  หน้าการ์ตูนตัวอย่าง (เลือกได้หลายหน้า)
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setSamplePageFiles(Array.from(e.target.files ?? []))}
                    className="rounded-xl border border-dashed border-zinc-300 p-2 text-xs"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={submittingCreator}
                className="rounded-xl bg-[#00dc64] px-6 py-2.5 text-xs font-black text-white disabled:opacity-50"
              >
                {submittingCreator ? 'กำลังอัปโหลดผลงานตัวอย่าง...' : 'ยืนยันส่งผลงานตัวอย่างให้แอดมินตรวจ'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Icon Shortcut Grid */}
      <div className="grid grid-cols-3 gap-2.5 rounded-2xl border border-zinc-200 bg-white p-4 text-center text-xs font-bold sm:grid-cols-6 sm:gap-3 sm:p-5">
        {[
          { href: '/library', icon: 'book', label: 'คลัง & ประวัติ' },
          { href: '/wallet/topup', icon: 'coin', label: 'ร้านค้าเหรียญ' },
          { href: '/plans', icon: 'star', label: 'Plus' },
          { href: '/notifications', icon: 'bell', label: 'แจ้งเตือน' },
          { href: '/support', icon: 'bug', label: 'แจ้งปัญหา' },
          { href: '/settings', icon: 'settings', label: 'ตั้งค่า & PIN' },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 hover:bg-zinc-50"
          >
            <Icon name={item.icon} className="size-5 text-zinc-700" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Live Profile Banner */}
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${
          BANNER_GRADIENTS[bannerTheme] ?? BANNER_GRADIENTS.midnight
        } p-5 text-white sm:p-7`}
      >
        <div className="flex flex-wrap items-center gap-5">
          <div
            className={`grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-black text-2xl font-black text-[#00dc64] ${
              FRAME_STYLES[avatarFrame] ?? FRAME_STYLES.emerald
            }`}
          >
            {previewAvatar ? (
              <img src={previewAvatar} alt="" className="size-full object-cover" />
            ) : (
              (displayName?.[0] || 'U').toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${roleMeta.cls}`}>
              {roleMeta.label}
            </span>
            <h2 className="mt-1.5 text-2xl font-black">{displayName}</h2>
            <p className="mt-1 text-xs text-white/70">
              {bio || 'ปรับแต่งชื่อ รูปโปรไฟล์ และกรอบอวาตาร์ของคุณด้านล่าง'}
            </p>
          </div>
          {authenticated && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/auth/security', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'lock' }),
                  })
                  router.push('/security-gate')
                }}
                className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold"
              >
                🔒 ล็อกแอป (PIN / ลายนิ้วมือ)
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' })
                  await onUpdated()
                  router.push('/login')
                }}
                className="rounded-full border border-rose-400/40 bg-rose-500/20 px-4 py-2 text-xs font-bold text-rose-200"
              >
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Content Sub-Tabs: Customize / Purchased Episodes / Reading History / My Issues */}
      <div className="flex flex-wrap gap-2">
        {[
          ['edit', 'แต่งโปรไฟล์ & อัปโหลดรูป'],
          ['purchased', `ตอนที่ซื้อแล้ว (${state.unlockedChapters.length})`],
          ['history', `ประวัติการอ่าน (${state.readingHistory.length})`],
          ['issues', `ปัญหาที่แจ้ง (${state.issues.length})`],
        ].map(([k, label]) => (
          <button
            type="button"
            key={k}
            onClick={() => setProfileTab(k as any)}
            className={`rounded-full px-4 py-2 text-xs font-black ${
              profileTab === k ? 'bg-zinc-950 text-white' : 'border border-zinc-200 bg-white text-zinc-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {profileTab === 'edit' && (
        <form onSubmit={handleSaveProfile} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
          <h3 className="text-lg font-black">แต่งหน้าโปรไฟล์ของคุณ</h3>
          {msg && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">{msg}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold">
              ชื่อที่แสดง
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
                required
              />
            </label>
            <label className="grid gap-1 text-xs font-bold">
              อัปโหลดรูปโปรไฟล์ของคุณเอง (JPG/PNG/WebP)
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                className="rounded-xl border border-dashed border-zinc-300 p-2 text-xs"
              />
            </label>
          </div>

          <label className="grid gap-1 text-xs font-bold">
            คำแนะนำตัว (Bio)
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="แนะนำตัวให้เพื่อนนักอ่านรู้จัก..."
              className="rounded-xl border border-zinc-200 px-3.5 py-2 text-sm"
            />
          </label>

          <div>
            <p className="mb-2 text-xs font-bold">หรือเลือกรูปโปรไฟล์สำเร็จรูป:</p>
            <div className="flex flex-wrap gap-2">
              {seriesList.slice(0, 6).map((s) =>
                s.coverUrl ? (
                  <button
                    type="button"
                    key={s.slug}
                    onClick={() => {
                      setAvatarFile(null)
                      setPresetAvatarUrl(s.coverUrl!)
                    }}
                    className={`size-12 overflow-hidden rounded-full border-2 ${
                      presetAvatarUrl === s.coverUrl ? 'scale-110 border-[#00dc64]' : 'border-transparent'
                    }`}
                  >
                    <img src={s.coverUrl} alt="" className="size-full object-cover" />
                  </button>
                ) : null,
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold">กรอบอวาตาร์</p>
              <div className="flex flex-wrap gap-1.5">
                {['emerald', 'gold', 'neon', 'rose', 'royal'].map((f) => (
                  <button
                    type="button"
                    key={f}
                    onClick={() => setAvatarFrame(f)}
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      avatarFrame === f ? 'bg-zinc-950 text-white' : 'border border-zinc-200 text-zinc-600'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold">ธีมแบนเนอร์</p>
              <div className="flex flex-wrap gap-1.5">
                {['midnight', 'emerald', 'amber', 'rose', 'cyber'].map((b) => (
                  <button
                    type="button"
                    key={b}
                    onClick={() => setBannerTheme(b)}
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      bannerTheme === b ? 'bg-zinc-950 text-white' : 'border border-zinc-200 text-zinc-600'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className="rounded-full bg-[#00dc64] px-8 py-3 text-sm font-black text-white shadow-sm">
            {saving ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
          </button>
        </form>
      )}

      {profileTab === 'purchased' && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h3 className="text-lg font-black">คลังตอนที่ซื้อ / ปลดล็อกแล้ว</h3>
          {state.unlockedChapters.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">ยังไม่มีตอนที่ซื้อไว้ในคลัง</p>
          ) : (
            <div className="mt-4 divide-y divide-zinc-100">
              {state.unlockedChapters.map((ch) => {
                const series = seriesList.find((s) => s.slug === ch.series_slug)
                return (
                  <div key={ch.chapter_id} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                        {series?.coverUrl && <img src={series.coverUrl} alt="" className="size-full object-cover" />}
                      </div>
                      <div>
                        <b className="block text-sm">{series?.title || ch.series_slug}</b>
                        <p className="text-xs text-zinc-500">
                          ตอนที่ {ch.chapter_number} • {ch.coins_paid > 0 ? `${ch.coins_paid} เหรียญ` : 'ตั๋วฟรี'}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/read/${encodeURIComponent(ch.series_slug)}/${ch.chapter_number}`}
                      className="rounded-full bg-[#00dc64] px-4 py-2 text-xs font-black text-white"
                    >
                      อ่านเลย
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {profileTab === 'history' && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h3 className="text-lg font-black">ประวัติการอ่านล่าสุด</h3>
          {state.readingHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">ยังไม่มีประวัติการอ่าน</p>
          ) : (
            <div className="mt-4 divide-y divide-zinc-100">
              {state.readingHistory.map((h) => {
                const series = seriesList.find((s) => s.slug === h.seriesSlug)
                if (!series) return null
                return (
                  <div key={`${h.seriesSlug}-${h.chapterNumber}`} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                        {series.coverUrl && <img src={series.coverUrl} alt="" className="size-full object-cover" />}
                      </div>
                      <div>
                        <b className="block text-sm">{series.title}</b>
                        <p className="text-xs text-zinc-500">
                          ตอนที่ {h.chapterNumber} • อ่านถึง {h.percent}% • {h.updatedAt}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/read/${encodeURIComponent(series.slug)}/${h.chapterNumber}`}
                      className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-black"
                    >
                      อ่านต่อ →
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {profileTab === 'issues' && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black">ประวัติการแจ้งปัญหาของคุณ</h3>
            <Link href="/support" className="rounded-full bg-[#00dc64] px-4 py-2 text-xs font-black text-white">
              + แจ้งปัญหาใหม่
            </Link>
          </div>
          {state.issues.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">ยังไม่มีรายการแจ้งปัญหา</p>
          ) : (
            <div className="mt-4 divide-y divide-zinc-100 text-xs">
              {state.issues.map((iss) => (
                <div key={iss.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <b className="text-sm">{iss.subject}</b>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-bold">{iss.status}</span>
                  </div>
                  <p className="mt-1 text-zinc-500">{iss.description}</p>
                  {iss.admin_reply && (
                    <p className="mt-2 rounded-lg bg-emerald-50 p-2 font-bold text-emerald-800">
                      คำตอบจากแอดมิน: {iss.admin_reply}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PlansScreen({
  state,
  authenticated,
  onSuccess,
}: {
  state: NivatoonUserState
  authenticated: boolean
  onSuccess: () => Promise<void>
}) {
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-7">
          <p className="font-black">FREE</p>
          <b className="mt-4 block text-4xl">ฟรี</b>
          <p className="mt-3 text-sm text-zinc-500">
            เริ่มต้นรับ ตั๋วอ่านฟรี 3 ใบ และเช็กอินสะสมตั๋วเพิ่มได้ทุกวัน (พอยน์เริ่มต้น 0)
          </p>
        </div>

        <div className="rounded-2xl border-2 border-[#00dc64] bg-[#00dc64]/10 p-7">
          <p className="font-black text-[#00a84b]">NIVATOON PLUS</p>
          <b className="mt-4 block text-4xl">
            ฿{PLUS_PACKAGE.priceTHB} <small className="text-sm font-normal">/ เดือน</small>
          </b>
          <ul className="mt-4 grid gap-2 text-sm font-bold">
            <li>✓ ไม่มีโฆษณาคั่น</li>
            <li>✓ รับโบนัส +{PLUS_PACKAGE.coins} เหรียญทันทีหลังตรวจสลิป</li>
            <li>✓ ปลดล็อกอ่านตอนล่วงหน้าฟรีทุกเรื่อง</li>
          </ul>
          <button
            type="button"
            disabled={state.plan === 'plus'}
            onClick={() => setShowCheckoutModal(true)}
            className="mt-6 w-full rounded-full bg-[#00dc64] py-3.5 text-sm font-black text-white shadow-sm disabled:opacity-65"
          >
            {state.plan === 'plus'
              ? 'คุณเป็นสมาชิก NIVATOON PLUS แล้ว ✓'
              : `สมัคร NIVATOON PLUS (ชำระจริง ฿${PLUS_PACKAGE.priceTHB})`}
          </button>
        </div>
      </div>

      {/* Real Payment Checkout Modal for Package Subscription */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="my-auto max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-[#f7f8f9] p-4 shadow-2xl sm:p-5">
            <SlipPaymentCheckoutForm
              packageId={PLUS_PACKAGE.id}
              packageTitle="สมัครแพ็กเกจ NIVATOON PLUS (1 เดือน)"
              amountTHB={PLUS_PACKAGE.priceTHB}
              coinsLabel="สิทธิ์ PLUS + 300 เหรียญ"
              authenticated={authenticated}
              onSuccess={async () => {
                await onSuccess()
                setShowCheckoutModal(false)
              }}
              onCancel={() => setShowCheckoutModal(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}

export function SettingsScreen({
  state,
  authUser,
  saveThemePreference,
  onUpdated,
}: {
  state: NivatoonUserState
  authUser: any
  saveThemePreference: (mode: 'light' | 'dark') => Promise<any>
  onUpdated?: () => Promise<void>
}) {
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark'>(state.themeMode || 'light')
  const [themeMsg, setThemeMsg] = useState<string | null>(null)
  const [savingTheme, setSavingTheme] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingPass, setSavingPass] = useState(false)

  // Change / Set 6-digit PIN state
  const [pinVerifyMode, setPinVerifyMode] = useState<'pin' | 'password'>(
    authUser?.hasPin ? 'pin' : 'password',
  )
  const [currentPinInput, setCurrentPinInput] = useState('')
  const [pinAccountPass, setPinAccountPass] = useState('')
  const [newPinInput, setNewPinInput] = useState('')
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('')
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingPin, setSavingPin] = useState(false)

  useEffect(() => {
    setSelectedTheme(state.themeMode || 'light')
  }, [state.themeMode])

  useEffect(() => {
    if (authUser && !authUser.hasPin) {
      setPinVerifyMode('password')
    }
  }, [authUser])

  const handleSaveTheme = async () => {
    setSavingTheme(true)
    setThemeMsg(null)
    try {
      const res = await saveThemePreference(selectedTheme)
      setThemeMsg(res?.message || 'บันทึกธีมและตั้งค่าเรียบร้อยแล้ว ✓')
    } catch {
      setThemeMsg('ไม่สามารถบันทึกการตั้งค่าได้')
    } finally {
      setSavingTheme(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassMsg(null)
    if (newPassword !== confirmPassword) {
      setPassMsg({ ok: false, text: 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน' })
      return
    }
    setSavingPass(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setPassMsg({ ok: false, text: data.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ' })
        return
      }
      setPassMsg({ ok: true, text: data.message || 'เปลี่ยนรหัสผ่านสำเร็จแล้ว ✓' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setPassMsg({ ok: false, text: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' })
    } finally {
      setSavingPass(false)
    }
  }

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinMsg(null)
    if (!/^\d{6}$/.test(newPinInput)) {
      setPinMsg({ ok: false, text: 'กรุณากรอกรหัส PIN ใหม่เป็นตัวเลข 6 หลัก' })
      return
    }
    if (newPinInput !== confirmNewPinInput) {
      setPinMsg({ ok: false, text: 'รหัส PIN ใหม่และยืนยันรหัส PIN ไม่ตรงกัน' })
      return
    }
    setSavingPin(true)
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          pinVerifyMode === 'pin' && authUser?.hasPin
            ? { currentPin: currentPinInput, newPin: newPinInput }
            : { currentPassword: pinAccountPass, newPin: newPinInput },
        ),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setPinMsg({ ok: false, text: data.error || 'เปลี่ยนรหัส PIN ไม่สำเร็จ' })
        return
      }
      setPinMsg({ ok: true, text: data.message || 'เปลี่ยนรหัส PIN 6 หลักเรียบร้อยแล้ว ✓' })
      setCurrentPinInput('')
      setPinAccountPass('')
      setNewPinInput('')
      setConfirmNewPinInput('')
      await onUpdated?.()
    } catch {
      setPinMsg({ ok: false, text: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัส PIN' })
    } finally {
      setSavingPin(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Theme Selection & Save */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
        <h1 className="text-xl font-black">ตั้งค่าธีมและการแสดงผล</h1>
        <p className="mt-1 break-all text-xs text-zinc-500">
          บัญชี: <b>{authUser?.email || state.email || '—'}</b> — เลือกโหมดสว่าง (ขาว) หรือโหมดมืด (ดำ) แล้วกดบันทึก
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { key: 'light', icon: 'sun', title: 'โหมดสว่าง (ขาว)', desc: 'อ่านสบายตาในเวลากลางวัน' },
            { key: 'dark', icon: 'moon', title: 'โหมดมืด (ดำ)', desc: 'ถนอมสายตาและลดแสงในที่มืด' },
          ].map((opt) => (
            <button
              type="button"
              key={opt.key}
              onClick={() => setSelectedTheme(opt.key as 'light' | 'dark')}
              className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left ${
                selectedTheme === opt.key ? 'border-[#00dc64] bg-[#00dc64]/10' : 'border-zinc-200'
              }`}
            >
              <Icon name={opt.icon} className="size-6 shrink-0 text-[#00a84b]" />
              <div>
                <b className="block text-sm font-black">{opt.title}</b>
                <span className="text-xs text-zinc-500">{opt.desc}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={savingTheme}
            onClick={() => void handleSaveTheme()}
            className="w-full rounded-full bg-[#00dc64] px-6 py-2.5 text-xs font-black text-white shadow-sm sm:w-auto"
          >
            {savingTheme ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าธีม'}
          </button>
          {themeMsg && <span className="text-xs font-bold text-[#00a84b]">{themeMsg}</span>}
        </div>
      </section>

      {/* Change Password */}
      <form onSubmit={handleChangePassword} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-black">เปลี่ยนรหัสผ่านบัญชี</h2>
        {passMsg && (
          <div
            className={`rounded-xl p-3 text-xs font-bold ${
              passMsg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {passMsg.text}
          </div>
        )}
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="รหัสผ่านปัจจุบัน"
          className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
            className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="ยืนยันรหัสผ่านใหม่"
            className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
            required
          />
        </div>
        <button
          type="submit"
          disabled={savingPass}
          className="w-full rounded-full bg-zinc-950 px-6 py-2.5 text-xs font-black text-white sm:w-auto"
        >
          {savingPass ? 'กำลังอัปเดต...' : 'บันทึกรหัสผ่านใหม่'}
        </button>
      </form>

      {/* Change / Set 6-Digit PIN */}
      <form onSubmit={handleChangePin} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black">
              {authUser?.hasPin ? 'เปลี่ยนรหัส PIN ความปลอดภัย 6 หลัก' : 'ตั้งค่ารหัส PIN 6 หลัก'}
            </h2>
            <p className="text-xs text-zinc-500">ใช้ปลดล็อกหน้าจอเข้าใช้งานและสแกนลายนิ้วมือ</p>
          </div>
          {authUser?.hasPin && (
            <div className="flex rounded-xl bg-zinc-100 p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setPinVerifyMode('pin')}
                className={`rounded-lg px-3 py-1.5 ${
                  pinVerifyMode === 'pin' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'
                }`}
              >
                ใช้ PIN เดิมยืนยัน
              </button>
              <button
                type="button"
                onClick={() => setPinVerifyMode('password')}
                className={`rounded-lg px-3 py-1.5 ${
                  pinVerifyMode === 'password' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'
                }`}
              >
                ใช้รหัสผ่านยืนยัน
              </button>
            </div>
          )}
        </div>

        {pinMsg && (
          <div
            className={`rounded-xl p-3 text-xs font-bold ${
              pinMsg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {pinMsg.text}
          </div>
        )}

        {pinVerifyMode === 'pin' && authUser?.hasPin ? (
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={currentPinInput}
            onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="รหัส PIN ปัจจุบัน (6 หลัก)"
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 font-mono text-sm tracking-[0.4em] placeholder:font-sans placeholder:tracking-normal"
            required
          />
        ) : (
          <input
            type="password"
            value={pinAccountPass}
            onChange={(e) => setPinAccountPass(e.target.value)}
            placeholder="รหัสผ่านบัญชีปัจจุบันเพื่อยืนยันตัวตน"
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
            required
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPinInput}
            onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="รหัส PIN ใหม่ (ตัวเลข 6 หลัก)"
            className="rounded-xl border border-zinc-200 px-3.5 py-2.5 font-mono text-sm tracking-[0.4em] placeholder:font-sans placeholder:tracking-normal"
            required
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmNewPinInput}
            onChange={(e) => setConfirmNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="ยืนยันรหัส PIN ใหม่ 6 หลัก"
            className="rounded-xl border border-zinc-200 px-3.5 py-2.5 font-mono text-sm tracking-[0.4em] placeholder:font-sans placeholder:tracking-normal"
            required
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={savingPin}
            className="w-full rounded-full bg-[#00dc64] px-6 py-2.5 text-xs font-black text-white shadow-sm sm:w-auto"
          >
            {savingPin ? 'กำลังบันทึกรหัส PIN...' : 'บันทึกรหัส PIN 6 หลักใหม่'}
          </button>
          <Link
            href="/security-gate"
            className="w-full rounded-full border border-zinc-200 px-5 py-2.5 text-center text-xs font-bold sm:w-auto"
          >
            ลงทะเบียนลายนิ้วมือ →
          </Link>
        </div>
      </form>
    </div>
  )
}

export function SupportScreen({
  state,
  onUpdated,
}: {
  state: NivatoonUserState
  onUpdated: () => Promise<void>
}) {
  const [category, setCategory] = useState('reading')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setSending(true)
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          subject,
          description,
          pageUrl: typeof window !== 'undefined' ? window.location.pathname : '',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setMsg(data.error || 'แจ้งปัญหาไม่สำเร็จ')
        return
      }
      setMsg('ส่งรายงานปัญหาถึงทีมแอดมินเรียบร้อยแล้ว ✓')
      setSubject('')
      setDescription('')
      await onUpdated()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-black">แจ้งปัญหาการใช้งาน / ติดต่อแอดมิน</h1>
        {msg && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">{msg}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold">
            หมวดหมู่ปัญหา
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
            >
              <option value="reading">ภาพโหลดช้า / อ่านตอนไม่ได้</option>
              <option value="payment">ปัญหาเติมเหรียญ / สลิปชำระเงิน</option>
              <option value="account">บัญชี / รหัสผ่าน / PIN</option>
              <option value="bug">พบข้อผิดพลาดของระบบ (Bug)</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold">
            หัวข้อปัญหา
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="เช่น โอนเงินแล้วเหรียญยังไม่เข้า..."
              className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
              required
            />
          </label>
        </div>

        <label className="grid gap-1 text-xs font-bold">
          รายละเอียดเพิ่มเติม
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="อธิบายขั้นตอนที่เกิดปัญหา หรือระบุเลขอ้างอิงสลิป..."
            className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
            required
          />
        </label>

        <button
          type="submit"
          disabled={sending}
          className="rounded-full bg-[#00dc64] px-7 py-3 text-sm font-black text-white"
        >
          {sending ? 'กำลังส่ง...' : 'ส่งเรื่องแจ้งปัญหา'}
        </button>
      </form>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-black">รายการที่คุณแจ้งไว้ล่าสุด</h2>
        {state.issues.length === 0 ? (
          <p className="py-6 text-sm text-zinc-400">ยังไม่มีรายการแจ้งปัญหา</p>
        ) : (
          <div className="mt-3 divide-y divide-zinc-100 text-xs">
            {state.issues.map((iss) => (
              <div key={iss.id} className="py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm">{iss.subject}</b>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-black ${
                      iss.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {iss.status === 'resolved' ? 'แก้ไขแล้ว' : iss.status === 'investigating' ? 'กำลังตรวจสอบ' : 'รอตรวจสอบ'}
                  </span>
                </div>
                <p className="mt-1 text-zinc-500">{iss.description}</p>
                {iss.admin_reply && (
                  <div className="mt-2 rounded-xl bg-emerald-50 p-3 font-bold text-emerald-800">
                    ตอบกลับจากแอดมิน: {iss.admin_reply}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function NotificationsScreen({
  notifications,
  onMarkAllRead,
}: {
  notifications: AppNotificationItem[]
  onMarkAllRead?: () => void
}) {
  useEffect(() => {
    if (notifications.some((n) => !n.isRead)) {
      onMarkAllRead?.()
    }
  }, [notifications, onMarkAllRead])

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-black sm:text-2xl">การแจ้งเตือนและโปรโมชั่นทั้งหมด</h1>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={() => onMarkAllRead?.()}
            className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-bold text-zinc-600 hover:border-[#00dc64]"
          >
            ✓ อ่านแล้วทั้งหมด
          </button>
        )}
      </div>
      <div className="mt-5 space-y-3">
        {notifications.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">ยังไม่มีประกาศหรือโปรโมชั่นใหม่</p>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#00dc64] px-2 py-0.5 text-[10px] font-black text-white">
                    {n.badge}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      n.isRead ? 'bg-zinc-200 text-zinc-600' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {n.isRead ? 'อ่านแล้ว' : 'ใหม่'}
                  </span>
                  <b className="text-sm">{n.title}</b>
                </div>
                <p className="mt-1 text-xs text-zinc-600">{n.message}</p>
              </div>
              {n.cta_url && (
                <Link href={n.cta_url} className="w-full rounded-full bg-zinc-950 px-4 py-2 text-center text-xs font-black text-white sm:w-auto">
                  ดูรายละเอียด →
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
