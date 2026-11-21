'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Header, Footer } from './chrome'
import { useNivatoonDatabase, type UserRole } from './store'
import { type ComicSeriesRecord } from '@/lib/database'

const ROLE_BADGE: Record<UserRole, { label: string; cls: string }> = {
  user: { label: 'นักอ่าน (User)', cls: 'bg-zinc-100 text-zinc-700' },
  creator: { label: 'ผู้อัพผลงาน (Creator)', cls: 'bg-[#00dc64]/15 text-[#008f42]' },
  admin: { label: 'ผู้ดูแลระบบ (Admin)', cls: 'bg-zinc-950 text-[#00dc64]' },
}

export function AnalyticsDashboardPage({
  initialSeries,
}: {
  initialSeries?: ComicSeriesRecord[]
}) {
  const {
    seriesList,
    state,
    searchQuery,
    setSearchQuery,
    authenticated,
    authUser,
    authLoaded,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
  } = useNivatoonDatabase(initialSeries)

  const [data, setData] = useState<any>(null)
  const [forbidden, setForbidden] = useState(false)
  const [adminTab, setAdminTab] = useState<
    'overview' | 'requests' | 'users' | 'comments' | 'notifications' | 'issues' | 'settings' | 'logs'
  >('overview')
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [previewReq, setPreviewReq] = useState<any>(null)

  // Notifications create form
  const [promoTitle, setPromoTitle] = useState('')
  const [promoMsg, setPromoMsg] = useState('')
  const [promoType, setPromoType] = useState<'promo' | 'announcement' | 'update'>('promo')
  const [promoBadge, setPromoBadge] = useState('PROMO')
  const [promoCta, setPromoCta] = useState('/wallet/topup')

  // Issues reply draft
  const [issueReplyMap, setIssueReplyMap] = useState<Record<string, string>>({})

  // Admin AI / Email / Rules settings
  const [aiSettings, setAiSettings] = useState<any>(null)
  const [rulesMd, setRulesMd] = useState('')
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('')
  const [smtpPassInput, setSmtpPassInput] = useState('')
  const [githubTokenInput, setGithubTokenInput] = useState('')
  const [smtpTestEmail, setSmtpTestEmail] = useState('trcrayrai@gmail.com')
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [syncingCloud, setSyncingCloud] = useState(false)
  const [logFilter, setLogFilter] = useState('all')

  const loadAdminData = async () => {
    try {
      const r = await fetch('/api/admin/overview', { cache: 'no-store' })
      if (r.status === 401 || r.status === 403) {
        setForbidden(true)
        return
      }
      const json = await r.json()
      if (json?.ok) {
        setForbidden(false)
        setData(json)
      }
    } catch {}
  }

  const loadAdminSettings = async () => {
    try {
      const r = await fetch('/api/admin/settings', { cache: 'no-store' })
      const json = await r.json()
      if (json?.ok) {
        setAiSettings(json.settings)
        setRulesMd(json.rulesMarkdown || '')
      }
    } catch {}
  }

  useEffect(() => {
    void loadAdminData()
    void loadAdminSettings()
  }, [authenticated, authUser?.role])

  const handleReviewCreator = async (requestId: string, decision: 'approve' | 'reject') => {
    setActionMsg(null)
    const res = await fetch('/api/admin/creator-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, decision }),
    })
    const json = await res.json()
    if (json.ok) {
      setActionMsg(
        decision === 'approve' ? 'อนุมัติสิทธิ์ Creator สำเร็จแล้ว' : 'ปฏิเสธคำขอแล้ว',
      )
      setPreviewReq(null)
      await loadAdminData()
    }
  }

  const handleChangeUserRole = async (userId: string, role: UserRole) => {
    setActionMsg(null)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    })
    const json = await res.json()
    if (json.ok) {
      setActionMsg(`ปรับระดับสิทธิ์ผู้ใช้เป็น ${role} สำเร็จแล้ว`)
      await loadAdminData()
    }
  }

  const handleDeleteComment = async (id: string) => {
    const res = await fetch(`/api/admin/comments?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) {
      setActionMsg('ลบคอมเมนต์เรียบร้อยแล้ว')
      await loadAdminData()
    }
  }

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: promoTitle,
        message: promoMsg,
        type: promoType,
        badge: promoBadge,
        ctaUrl: promoCta,
      }),
    })
    const json = await res.json()
    if (json.ok) {
      setActionMsg('ประกาศแจ้งเตือน & โปรโมชั่นใหม่แล้ว')
      setPromoTitle('')
      setPromoMsg('')
      await loadAdminData()
    }
  }

  const handleToggleNotif = async (id: string, isActive: boolean) => {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive }),
    })
    await loadAdminData()
  }

  const handleDeleteNotif = async (id: string) => {
    await fetch(`/api/admin/notifications?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    await loadAdminData()
  }

  const handleUpdateIssue = async (issueId: string, status: string) => {
    const res = await fetch('/api/admin/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueId,
        status,
        adminReply: issueReplyMap[issueId] ?? '',
      }),
    })
    const json = await res.json()
    if (json.ok) {
      setActionMsg(`อัปเดตสถานะปัญหา ${issueId} เรียบร้อย`)
      await loadAdminData()
    }
  }

  const handleSaveAdminSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiSettings) return
    setActionMsg(null)
    setActionError(null)
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(geminiApiKeyInput.trim() ? { geminiApiKey: geminiApiKeyInput.trim() } : {}),
        geminiModelReasoning: aiSettings.geminiModelReasoning,
        geminiModelTts: aiSettings.geminiModelTts,
        geminiModelImage: aiSettings.geminiModelImage,
        geminiModelDecision: aiSettings.geminiModelDecision,
        smtpHost: aiSettings.smtpHost,
        smtpPort: aiSettings.smtpPort,
        smtpUser: aiSettings.smtpUser,
        smtpFrom: aiSettings.smtpFrom,
        ...(smtpPassInput.trim() ? { smtpPass: smtpPassInput.trim() } : {}),
        ...(githubTokenInput.trim() ? { githubToken: githubTokenInput.trim() } : {}),
        strictSlipCheck: aiSettings.strictSlipCheck,
      }),
    })
    const json = await res.json()
    if (json.ok) {
      setAiSettings(json.settings)
      setGeminiApiKeyInput('')
      setSmtpPassInput('')
      setGithubTokenInput('')
      setActionMsg(json.message || 'บันทึกการตั้งค่า AI / Email / GitHub สำเร็จ')
      await loadAdminData()
    } else {
      setActionError(json.error || 'บันทึกไม่สำเร็จ')
    }
  }

  const handleTestSmtp = async () => {
    setActionMsg(null)
    setActionError(null)
    setTestingSmtp(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_smtp', testTo: smtpTestEmail }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setActionError(json.error || 'ทดสอบส่งอีเมลไม่สำเร็จ')
      } else {
        setActionMsg(json.message || 'ทดสอบส่งเมลสำเร็จ ✓')
      }
      await loadAdminData()
    } finally {
      setTestingSmtp(false)
    }
  }

  const handleSyncCloudNow = async () => {
    setActionMsg(null)
    setActionError(null)
    setSyncingCloud(true)
    try {
      const res = await fetch('/api/cloud/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushToGitHub: true }),
      })
      const json = await res.json()
      if (json.ok) {
        const counts = json.firebaseSync?.counts || {}
        setActionMsg(
          `ซิงก์คลังไฟล์ GitHub (OhmmyTRC/nivatoon) และฐานข้อมูล Firebase (niva-421c2) สำเร็จ ✓ (${counts.series ?? 0} เรื่อง, ${counts.users ?? 0} ผู้ใช้, ${counts.transactions ?? 0} ธุรกรรม)`,
        )
        await loadAdminData()
      } else {
        setActionError(json.error || 'ซิงก์ข้อมูลคลาวด์ไม่สำเร็จ')
      }
    } finally {
      setSyncingCloud(false)
    }
  }

  const maxViews = Math.max(
    1,
    ...(data?.popularSeries ?? []).map((s: any) => Number(s.views_count || 0)),
  )

  const filteredLogs = (data?.recentLogs ?? []).filter(
    (l: any) => logFilter === 'all' || l.category === logFilter,
  )

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

      <main className="mx-auto min-h-[75vh] max-w-[1280px] px-3 py-6 pb-24 sm:px-4 sm:py-8 md:pb-8 lg:px-8">
        {authLoaded && (forbidden || authUser?.role !== 'admin') ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-10 text-center">
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700">
              ACCESS DENIED (403)
            </span>
            <h1 className="mt-4 text-2xl font-black">หน้านี้สำหรับผู้ดูแลระบบ (Admin) เท่านั้น</h1>
            <p className="mt-2 text-sm text-zinc-500">บัญชีนักอ่านและครีเอเตอร์ไม่สามารถเข้าถึงข้อมูลหลังบ้านได้</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/login" className="rounded-full bg-[#00dc64] px-6 py-2.5 text-xs font-black text-white">
                เข้าสู่ระบบบัญชี Admin
              </Link>
              <Link href="/" className="rounded-full border border-zinc-200 px-6 py-2.5 text-xs font-bold">
                กลับหน้าหลัก
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-950 px-3 py-1 text-[11px] font-black text-[#00dc64]">
                    ADMIN BACKOFFICE
                  </span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">
                    GitHub File Storage: {data?.githubStorage?.repository || 'OhmmyTRC/nivatoon'} (
                    {data?.githubStorage?.seriesCount ?? 11} เรื่อง •{' '}
                    {data?.githubStorage?.totalPages ?? 70} หน้า)
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                      data?.firebaseConnected
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Firebase DB (niva-421c2):{' '}
                    {data?.firebaseConnected ? 'Firestore & RTDB ซิงก์คลาวด์ ✓' : 'รอ Service Account Key'}
                  </span>
                  <button
                    type="button"
                    disabled={syncingCloud}
                    onClick={() => void handleSyncCloudNow()}
                    className="rounded-full bg-[#00dc64] px-3.5 py-1 text-[11px] font-black text-white shadow-sm hover:bg-[#00c75a] disabled:opacity-50"
                  >
                    {syncingCloud ? 'กำลังซิงก์ GitHub & Firebase...' : '☁️ ซิงก์ GitHub + Firebase ทันที'}
                  </button>
                  <a
                    href="/nivatoon-release.apk"
                    download="nivatoon-release.apk"
                    className="rounded-full bg-zinc-950 px-3.5 py-1 text-[11px] font-black text-[#00dc64] shadow-sm hover:bg-zinc-800"
                  >
                    📱 ดาวน์โหลดแอป Android (.APK)
                  </a>
                </div>
                <h1 className="mt-2 text-3xl font-black">ระบบจัดการหลังบ้าน NIVATOON</h1>
              </div>

              <div className="no-scrollbar flex flex-nowrap gap-1.5 overflow-x-auto pb-1 sm:flex-wrap">
                {[
                  ['overview', 'ภาพรวม'],
                  ['requests', `คำขออัพผลงาน (${data?.summary?.pending_creator_requests ?? 0})`],
                  ['users', 'จัดการยศ'],
                  ['notifications', 'แจ้งเตือน & โปรโมท'],
                  ['issues', `แจ้งปัญหา (${data?.summary?.open_issues ?? 0})`],
                  ['comments', 'คอมเมนต์'],
                  ['settings', 'ตั้งค่า AI / Email & กฎ'],
                  ['logs', `Logs (${data?.summary?.total_logs ?? 0})`],
                ].map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setAdminTab(key as any)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-black ${
                      adminTab === key
                        ? 'bg-zinc-950 text-[#00dc64]'
                        : 'border border-zinc-200 bg-white text-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {actionMsg && (
              <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                ✓ {actionMsg}
              </div>
            )}
            {actionError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold leading-5 text-rose-700">
                {actionError}
              </div>
            )}

            {/* KPI Summary */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ['ยอดเติมเงินรวม', `฿${(data?.summary?.total_revenue_thb ?? 0).toLocaleString()}`, true],
                ['พอยน์ที่เติมเข้าระบบ', `${(data?.summary?.total_coins_issued ?? 0).toLocaleString()}`, false],
                ['สมาชิกทั้งหมด', `${data?.summary?.total_users ?? 0} คน`, false],
                ['ครีเอเตอร์อนุมัติแล้ว', `${data?.summary?.total_creators ?? 0} คน`, false],
                ['ปัญหาที่รอแก้ไข', `${data?.summary?.open_issues ?? 0} เคส`, false],
              ].map(([label, val, highlight]) => (
                <div
                  key={String(label)}
                  className={`rounded-2xl border p-5 ${
                    highlight ? 'border-[#00dc64] bg-[#00dc64]/10' : 'border-zinc-200 bg-white'
                  }`}
                >
                  <p className="text-xs font-bold text-zinc-500">{label}</p>
                  <b className="mt-1.5 block text-2xl font-black">{val}</b>
                </div>
              ))}
            </div>

            {adminTab === 'overview' && (
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-zinc-200 bg-white p-6">
                  <h2 className="text-lg font-black">อันดับยอดเติมเงินสูงสุด (Top Spenders)</h2>
                  <div className="mt-4 divide-y divide-zinc-100">
                    {(data?.topSpenders ?? []).slice(0, 8).map((u: any, idx: number) => (
                      <div key={u.id} className="flex items-center gap-3 py-3 text-xs">
                        <span className="grid size-7 place-items-center rounded-full bg-zinc-100 font-black">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <b className="block truncate text-sm">{u.display_name}</b>
                          <span className="text-zinc-400">
                            {u.email} • ยศ {u.role}
                          </span>
                        </div>
                        <div className="text-right">
                          <b className="block text-sm text-[#00a84b]">
                            ฿{Number(u.total_topup_thb || 0).toLocaleString()}
                          </b>
                          <span className="text-zinc-400">
                            {Number(u.total_topup_coins || 0).toLocaleString()} พอยน์
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-zinc-200 bg-white p-6">
                  <h2 className="text-lg font-black">มังงะที่ได้รับความนิยมสูงสุด</h2>
                  <div className="mt-4 space-y-3.5">
                    {(data?.popularSeries ?? []).slice(0, 8).map((s: any, idx: number) => {
                      const pct = Math.max(12, Math.round((Number(s.views_count || 0) / maxViews) * 100))
                      return (
                        <div key={s.series_slug}>
                          <div className="flex justify-between text-xs font-bold">
                            <span>
                              {idx + 1}. {s.title}
                            </span>
                            <span className="text-zinc-500">
                              {Number(s.views_count).toLocaleString()} วิว • ★ {s.avg_rating}
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full rounded-full bg-zinc-100">
                            <div
                              className={`h-full rounded-full ${idx === 0 ? 'bg-[#00dc64]' : 'bg-zinc-900'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-zinc-200 bg-white p-6 lg:col-span-2">
                  <h2 className="text-lg font-black">รายการตรวจสอบยอดโอน PromptPay &amp; TrueMoney ล่าสุด</h2>
                  <div className="mt-4 divide-y divide-zinc-100 text-xs">
                    {(data?.recentTransactions ?? []).map((tx: any) => (
                      <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div>
                          <b className="text-sm">{tx.display_name || 'ลูกค้า'}</b>
                          <p className="text-zinc-500">
                            [{tx.provider.toUpperCase()}] {tx.reference} • {tx.verification_note}
                          </p>
                        </div>
                        <div className="text-right">
                          <b className="text-sm text-[#00a84b]">+{tx.coins} พอยน์</b>
                          <p className="text-zinc-400">฿{tx.amount_thb}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {adminTab === 'requests' && (
              <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
                <h2 className="text-xl font-black">คำขอสิทธิ์ลงผลงาน &amp; ผลงานตัวอย่าง (Creator Requests)</h2>
                <div className="mt-4 divide-y divide-zinc-100">
                  {(data?.creatorRequests ?? []).length === 0 ? (
                    <p className="py-6 text-sm text-zinc-500">ยังไม่มีคำขอเข้ามา</p>
                  ) : (
                    (data?.creatorRequests ?? []).map((req: any) => {
                      let pagesArr: string[] = []
                      try {
                        pagesArr = req.sample_pages_json ? JSON.parse(req.sample_pages_json) : []
                      } catch {}
                      return (
                        <div key={req.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                          <div className="flex max-w-2xl items-center gap-4">
                            {req.sample_cover_url && (
                              <img
                                src={req.sample_cover_url}
                                alt=""
                                className="h-20 w-14 shrink-0 rounded-lg border border-zinc-200 object-cover"
                              />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <b className="text-base">{req.pen_name}</b>
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                                    req.status === 'pending'
                                      ? 'bg-amber-100 text-amber-800'
                                      : req.status === 'approved'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-700'
                                  }`}
                                >
                                  {req.status}
                                </span>
                              </div>
                              <p className="mt-1 text-xs font-bold text-zinc-700">
                                ผลงาน: {req.sample_title} (โดย {req.display_name} • {req.email})
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">{req.portfolio_note}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {(req.sample_cover_url || pagesArr.length > 0) && (
                              <button
                                type="button"
                                onClick={() => setPreviewReq({ ...req, pagesArr })}
                                className="rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2 text-xs font-black text-zinc-900 hover:border-[#00dc64]"
                              >
                                👁️ เปิดดูผลงานตัวอย่าง ({pagesArr.length || 1})
                              </button>
                            )}
                            {req.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleReviewCreator(req.id, 'approve')}
                                  className="rounded-full bg-[#00dc64] px-4 py-2 text-xs font-black text-white"
                                >
                                  ✓ อนุมัติสิทธิ์ Creator
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleReviewCreator(req.id, 'reject')}
                                  className="rounded-full border border-rose-300 px-4 py-2 text-xs font-bold text-rose-600"
                                >
                                  ปฏิเสธ
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            )}

            {adminTab === 'users' && (
              <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
                <h2 className="text-xl font-black">จัดการสมาชิกและยศ (Roles)</h2>
                <div className="mt-4 divide-y divide-zinc-100">
                  {(data?.allUsers ?? []).map((u: any) => (
                    <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-xs">
                      <div>
                        <b className="text-sm">{u.display_name}</b>
                        <p className="text-zinc-500">
                          {u.email} • เหรียญ: {Number(u.coin_balance || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${ROLE_BADGE[(u.role as UserRole) || 'user'].cls}`}>
                          {ROLE_BADGE[(u.role as UserRole) || 'user'].label}
                        </span>
                        <select
                          value={u.role || 'user'}
                          onChange={(e) => void handleChangeUserRole(u.id, e.target.value as UserRole)}
                          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 font-bold"
                        >
                          <option value="user">user (นักอ่าน)</option>
                          <option value="creator">creator (ผู้อัพผลงาน)</option>
                          <option value="admin">admin (แอดมิน)</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {adminTab === 'notifications' && (
              <div className="mt-8 grid gap-6 lg:grid-cols-[400px_1fr]">
                <form onSubmit={handleCreatePromo} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6">
                  <h2 className="text-lg font-black">สร้างประกาศ &amp; โปรโมทโปรโมชั่น</h2>
                  <input
                    value={promoTitle}
                    onChange={(e) => setPromoTitle(e.target.value)}
                    placeholder="หัวข้อแจ้งเตือน / โปรโมชั่น"
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
                    required
                  />
                  <textarea
                    rows={3}
                    value={promoMsg}
                    onChange={(e) => setPromoMsg(e.target.value)}
                    placeholder="ข้อความโปรโมทหรือรายละเอียดกิจกรรม..."
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={promoType}
                      onChange={(e) => setPromoType(e.target.value as any)}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold"
                    >
                      <option value="promo">PROMO (โปรโมชั่น)</option>
                      <option value="announcement">NEWS (ประกาศ)</option>
                      <option value="update">UPDATE (ตอนใหม่)</option>
                    </select>
                    <input
                      value={promoBadge}
                      onChange={(e) => setPromoBadge(e.target.value)}
                      placeholder="ป้ายกำกับ เช่น HOT"
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold"
                    />
                  </div>
                  <input
                    value={promoCta}
                    onChange={(e) => setPromoCta(e.target.value)}
                    placeholder="ลิงก์ปลายทาง เช่น /wallet/topup"
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs"
                  />
                  <button type="submit" className="w-full rounded-xl bg-[#00dc64] py-3 text-xs font-black text-white">
                    เผยแพร่การแจ้งเตือนทันที
                  </button>
                </form>

                <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                  <h2 className="text-lg font-black">รายการโปรโมชั่นและการแจ้งเตือนทั้งหมด</h2>
                  <div className="mt-4 divide-y divide-zinc-100 text-xs">
                    {(data?.notifications ?? []).map((n: any) => (
                      <div key={n.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                        <div className="max-w-lg">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-[#00dc64] px-1.5 py-0.5 text-[10px] font-black text-white">
                              {n.badge}
                            </span>
                            <b className="text-sm">{n.title}</b>
                          </div>
                          <p className="mt-1 text-zinc-500">{n.message}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleToggleNotif(n.id, !n.is_active)}
                            className={`rounded-lg px-3 py-1.5 font-bold ${
                              n.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-500'
                            }`}
                          >
                            {n.is_active ? 'เปิดใช้งาน' : 'ปิดอยู่'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteNotif(n.id)}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 font-bold text-rose-600"
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {adminTab === 'issues' && (
              <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
                <h2 className="text-xl font-black">จัดการแจ้งปัญหาการใช้งาน (Support Tickets)</h2>
                <div className="mt-4 divide-y divide-zinc-100">
                  {(data?.issueReports ?? []).length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-400">ยังไม่มีรายงานปัญหาจากผู้ใช้งาน</p>
                  ) : (
                    (data?.issueReports ?? []).map((iss: any) => (
                      <div key={iss.id} className="space-y-2 py-4 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-black uppercase">
                              {iss.category}
                            </span>{' '}
                            <b className="text-sm">{iss.subject}</b>
                            <span className="ml-2 text-zinc-400">โดย {iss.user_email}</span>
                          </div>
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-black text-amber-800">
                            {iss.status}
                          </span>
                        </div>
                        <p className="text-zinc-600">{iss.description}</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <input
                            value={issueReplyMap[iss.id] ?? iss.admin_reply ?? ''}
                            onChange={(e) =>
                              setIssueReplyMap((prev) => ({ ...prev, [iss.id]: e.target.value }))
                            }
                            placeholder="พิมพ์คำตอบถึงผู้ใช้..."
                            className="w-full min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs sm:w-auto sm:min-w-64"
                          />
                          <button
                            type="button"
                            onClick={() => void handleUpdateIssue(iss.id, 'investigating')}
                            className="rounded-xl border border-zinc-200 px-3 py-2 font-bold"
                          >
                            รับเรื่องตรวจสอบ
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleUpdateIssue(iss.id, 'resolved')}
                            className="rounded-xl bg-[#00dc64] px-4 py-2 font-black text-white"
                          >
                            ✓ ปิดเคส (Resolved)
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {adminTab === 'comments' && (
              <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
                <h2 className="text-xl font-black">จัดการคอมเมนต์ทั้งหมด</h2>
                <div className="mt-4 divide-y divide-zinc-100">
                  {(data?.recentComments ?? []).map((c: any) => (
                    <div key={c.id} className="flex items-start justify-between gap-4 py-3.5 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <b>{c.author_name}</b>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold">
                            {c.series_slug} Ep.{c.chapter_number}
                          </span>
                        </div>
                        <p className="mt-1 text-zinc-700">{c.body}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteComment(c.id)}
                        className="shrink-0 rounded-lg border border-rose-200 px-3 py-1.5 font-bold text-rose-600 hover:bg-rose-50"
                      >
                        ลบ
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {adminTab === 'settings' && aiSettings && (
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <form onSubmit={handleSaveAdminSettings} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
                  <h2 className="text-lg font-black">ตั้งค่า AI API, โมเดล, SMTP Email &amp; สลิป</h2>
                  <p className="text-xs text-zinc-500">
                    สถานะ Gemini API: <b>{aiSettings.hasGeminiApiKey ? `พร้อมใช้งาน (${aiSettings.maskedGeminiKey})` : 'ยังไม่ได้ตั้งค่า'}</b>
                  </p>

                  <label className="grid gap-1 text-xs font-bold">
                    Gemini API Key ใหม่ (เว้นว่างไว้หากต้องการคงคีย์เดิม)
                    <input
                      type="password"
                      value={geminiApiKeyInput}
                      onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                      placeholder="ใส่เฉพาะเมื่อต้องการอัปเดตคีย์..."
                      className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2 text-xs font-bold">
                    <label className="grid gap-1">
                      โมเดล AI แปลภาพ / ตรวจสลิป
                      <input
                        value={aiSettings.geminiModelReasoning}
                        onChange={(e) => setAiSettings({ ...aiSettings, geminiModelReasoning: e.target.value })}
                        className="rounded-xl border border-zinc-200 px-3 py-2"
                      />
                    </label>
                    <label className="grid gap-1">
                      โมเดล AI พากย์เสียง (TTS)
                      <input
                        value={aiSettings.geminiModelTts}
                        onChange={(e) => setAiSettings({ ...aiSettings, geminiModelTts: e.target.value })}
                        className="rounded-xl border border-zinc-200 px-3 py-2"
                      />
                    </label>
                    <label className="grid gap-1">
                      โมเดลสร้างภาพ (Studio)
                      <input
                        value={aiSettings.geminiModelImage}
                        onChange={(e) => setAiSettings({ ...aiSettings, geminiModelImage: e.target.value })}
                        className="rounded-xl border border-zinc-200 px-3 py-2"
                      />
                    </label>
                    <label className="grid gap-1">
                      โมเดลตรวจสปอยล์ (Decisions)
                      <input
                        value={aiSettings.geminiModelDecision}
                        onChange={(e) => setAiSettings({ ...aiSettings, geminiModelDecision: e.target.value })}
                        className="rounded-xl border border-zinc-200 px-3 py-2"
                      />
                    </label>
                  </div>

                  <div className="border-t border-zinc-100 pt-3">
                    <b className="text-xs">ตั้งค่า SMTP ส่งอีเมลกู้คืนรหัสผ่าน (CODE 6 ตัว)</b>
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
                      <b>หมายเหตุสำคัญสำหรับ Gmail:</b> Google ไม่อนุญาตให้ใช้รหัสผ่านล็อกอินบัญชี Gmail ปกติในการส่งเมล SMTP (จะขึ้น Error 535-5.7.8) — กรุณาเปิด <b>2-Step Verification</b> บนบัญชีผู้ส่ง แล้วสร้าง{' '}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        className="font-black underline"
                      >
                        App Password 16 หลัก
                      </a>{' '}
                      มาวางในช่องรหัสผ่านด้านล่าง แล้วกดบันทึก &amp; ทดสอบส่งเมล
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
                      <input
                        value={aiSettings.smtpHost}
                        onChange={(e) => setAiSettings({ ...aiSettings, smtpHost: e.target.value })}
                        placeholder="smtp.gmail.com"
                        className="rounded-xl border border-zinc-200 px-3 py-2"
                      />
                      <input
                        value={aiSettings.smtpPort}
                        onChange={(e) => setAiSettings({ ...aiSettings, smtpPort: e.target.value })}
                        placeholder="587"
                        className="rounded-xl border border-zinc-200 px-3 py-2"
                      />
                      <input
                        value={aiSettings.smtpUser}
                        onChange={(e) => setAiSettings({ ...aiSettings, smtpUser: e.target.value })}
                        placeholder="อีเมลผู้ส่ง (เช่น nivatoonadmin@gmail.com)"
                        className="rounded-xl border border-zinc-200 px-3 py-2"
                      />
                      <input
                        type="password"
                        value={smtpPassInput}
                        onChange={(e) => setSmtpPassInput(e.target.value)}
                        placeholder={aiSettings.hasSmtpPass ? 'เปลี่ยน App Password 16 หลัก...' : 'App Password 16 หลัก (ไม่ใช่รหัสผ่าน Gmail ปกติ)'}
                        className="rounded-xl border border-zinc-200 px-3 py-2"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <input
                        type="email"
                        value={smtpTestEmail}
                        onChange={(e) => setSmtpTestEmail(e.target.value)}
                        placeholder="อีเมลรับทดสอบ"
                        className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2"
                      />
                      <button
                        type="button"
                        disabled={testingSmtp}
                        onClick={() => void handleTestSmtp()}
                        className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2 font-black text-zinc-900 hover:border-[#00dc64]"
                      >
                        {testingSmtp ? 'กำลังส่ง...' : 'ทดสอบส่งเมล SMTP'}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 pt-3">
                    <b className="text-xs">คลังเก็บไฟล์ GitHub (OhmmyTRC/nivatoon) &amp; ฐานข้อมูล Firebase (niva-421c2)</b>
                    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] leading-5 text-emerald-950">
                      <div>
                        <b>GitHub File Storage:</b>{' '}
                        <span className="font-mono">
                          https://raw.githubusercontent.com/{aiSettings.githubRepo || 'OhmmyTRC/nivatoon'}/main/public/comics/manifest.json
                        </span>
                      </div>
                      <div>
                        <b>Firebase Cloud Database:</b> Project <span className="font-mono">niva-421c2</span> (Cloud Firestore &amp; Realtime Database)
                      </div>
                      <div>
                        <b>GitHub API Token:</b>{' '}
                        {aiSettings.hasGithubToken ? `ตั้งค่าแล้ว (${aiSettings.maskedGithubToken})` : 'ใช้ Git CLI Push อัตโนมัติ (หรือใส่ Personal Access Token ด้านล่าง)'}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <input
                        type="password"
                        value={githubTokenInput}
                        onChange={(e) => setGithubTokenInput(e.target.value)}
                        placeholder={
                          aiSettings.hasGithubToken
                            ? 'เปลี่ยน GitHub Personal Access Token (ghp_...)...'
                            : 'ใส่ GitHub Personal Access Token (ghp_...) สำหรับอัปโหลดไฟล์ผ่าน API'
                        }
                        className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2"
                      />
                      <button
                        type="button"
                        disabled={syncingCloud}
                        onClick={() => void handleSyncCloudNow()}
                        className="rounded-xl bg-zinc-950 px-4 py-2 font-black text-[#00dc64] hover:bg-zinc-800 disabled:opacity-50"
                      >
                        {syncingCloud ? 'กำลังซิงก์...' : '☁️ ซิงก์ไฟล์ GitHub & Firebase'}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={Boolean(aiSettings.strictSlipCheck)}
                      onChange={(e) => setAiSettings({ ...aiSettings, strictSlipCheck: e.target.checked })}
                      className="size-4 accent-[#00dc64]"
                    />
                    ตรวจสลิปโอนเงินจริงอย่างเข้มงวด (ตรวจยอด + ชื่อบัญชี ธีรชาติ เครือวัลย์)
                  </label>

                  <button type="submit" className="w-full rounded-xl bg-[#00dc64] py-3 text-xs font-black text-white">
                    บันทึกการตั้งค่าระบบและ AI
                  </button>
                </form>

                <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                  <h2 className="text-lg font-black">เอกสารกฎ &amp; Config Rules (`CONFIG_RULES.md`)</h2>
                  <pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950 p-4 font-mono text-[11px] leading-5 text-emerald-200">
                    {rulesMd || 'ไม่พบไฟล์ CONFIG_RULES.md'}
                  </pre>
                </div>
              </div>
            )}

            {adminTab === 'logs' && (
              <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-black">บันทึกการทำงานของระบบ (System Logs)</h2>
                  <select
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold"
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="auth">เข้าสู่ระบบ / สมัคร</option>
                    <option value="auth-otp">กู้คืนรหัสผ่าน OTP</option>
                    <option value="payment">ชำระเงิน &amp; ตรวจสลิป</option>
                    <option value="checkin">เช็กอินรับตั๋ว</option>
                    <option value="ai-translate">Gemini AI</option>
                    <option value="creator-request">คำขอสิทธิ์ครีเอเตอร์</option>
                    <option value="admin-settings">การตั้งค่า Admin</option>
                    <option value="support">แจ้งปัญหา</option>
                  </select>
                </div>
                <div className="mt-4 divide-y divide-zinc-100 text-xs">
                  {filteredLogs.map((l: any) => (
                    <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div>
                        <span
                          className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
                            l.level === 'error'
                              ? 'bg-rose-100 text-rose-700'
                              : l.level === 'warn'
                                ? 'bg-amber-100 text-amber-800'
                                : l.level === 'security'
                                  ? 'bg-zinc-950 text-[#00dc64]'
                                  : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {l.category}
                        </span>
                        <span className="font-bold text-zinc-900">{l.message}</span>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400">
                        {l.actor_email || '-'} • {String(l.created_at).slice(0, 19).replace('T', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Admin Preview Modal for Creator Sample Artwork */}
      {previewReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div>
                <p className="text-[11px] font-black text-[#00a84b]">ตรวจสอบผลงานตัวอย่างก่อนอนุมัติ</p>
                <b className="text-lg font-black">{previewReq.sample_title} — โดย {previewReq.pen_name}</b>
              </div>
              <button type="button" onClick={() => setPreviewReq(null)} className="text-sm font-bold text-zinc-500">
                ปิด ✕
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div className="flex flex-wrap gap-4">
                {previewReq.sample_cover_url && (
                  <img
                    src={previewReq.sample_cover_url}
                    alt=""
                    className="h-44 w-32 rounded-xl border border-zinc-200 object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 text-xs leading-6 text-zinc-600">
                  <b className="text-sm text-zinc-950">รายละเอียดจากผู้ขอสิทธิ์</b>
                  <p className="mt-1">{previewReq.sample_synopsis || previewReq.portfolio_note}</p>
                  <p className="mt-2 font-bold text-zinc-500">อีเมล: {previewReq.email}</p>
                </div>
              </div>
              {Array.isArray(previewReq.pagesArr) && previewReq.pagesArr.length > 0 && (
                <div className="space-y-3 border-t border-zinc-100 pt-4">
                  <b className="block text-xs">หน้าตัวอย่างที่อัปโหลด ({previewReq.pagesArr.length} หน้า):</b>
                  {previewReq.pagesArr.map((pUrl: string) => (
                    <img key={pUrl} src={pUrl} alt="" className="w-full rounded-xl border border-zinc-200" />
                  ))}
                </div>
              )}
            </div>
            {previewReq.status === 'pending' && (
              <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => void handleReviewCreator(previewReq.id, 'reject')}
                  className="rounded-full border border-rose-300 px-5 py-2.5 text-xs font-bold text-rose-600"
                >
                  ปฏิเสธ
                </button>
                <button
                  type="button"
                  onClick={() => void handleReviewCreator(previewReq.id, 'approve')}
                  className="rounded-full bg-[#00dc64] px-6 py-2.5 text-xs font-black text-white"
                >
                  ✓ อนุมัติให้สิทธิ์ Creator ทันที
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
