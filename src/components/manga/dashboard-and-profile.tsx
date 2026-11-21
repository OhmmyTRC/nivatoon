'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Header, Footer } from './chrome'
import { useNivatoonDatabase } from './store'
import { type ComicSeriesRecord } from '@/lib/database'
import { WalletContent } from './payment-checkout'
import {
  MyWebtoonScreen,
  NotificationsScreen,
  PlansScreen,
  ProfileAndRoleHub,
  SettingsScreen,
  SupportScreen,
} from './account-screens'

export { AnalyticsDashboardPage } from './admin-dashboard'

export function DashboardPage({
  path,
  initialSeries,
  initialTopupPkg,
}: {
  path: string
  initialSeries?: ComicSeriesRecord[]
  initialTopupPkg?: string
}) {
  const {
    seriesList,
    state,
    updateState,
    selectTopupPackage,
    saveThemePreference,
    searchQuery,
    setSearchQuery,
    authenticated,
    authUser,
    latestCreatorRequest,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
    refreshAuth,
  } = useNivatoonDatabase(initialSeries)
  const router = useRouter()

  const todayKey = new Date().toISOString().slice(0, 10)
  const nextCycleDay = ((state.checkinDay ?? 0) % 7) + 1
  const nextTickets = nextCycleDay === 7 ? 3 : 1

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

      <main className="mx-auto min-h-[75vh] max-w-[1040px] px-3 py-5 pb-24 sm:px-4 sm:py-8 md:pb-8">
        {path.startsWith('wallet') ? (
          <WalletContent
            path={path}
            state={state}
            authenticated={authenticated}
            initialTopupPkg={initialTopupPkg}
            onSelectPackage={(pkgId, totalCoins, thb) => {
              selectTopupPackage(pkgId, totalCoins, thb)
              router.push(`/wallet/payment?package=${encodeURIComponent(pkgId)}`)
            }}
            onVerifiedSuccess={refreshAuth}
          />
        ) : path === 'profile' ? (
          <ProfileAndRoleHub
            seriesList={seriesList}
            authenticated={authenticated}
            authUser={authUser}
            latestCreatorRequest={latestCreatorRequest}
            state={state}
            onUpdated={refreshAuth}
            onCheckin={() => {
              if (state.lastCheckinDate === todayKey) return
              updateState(
                (prev) => ({
                  ...prev,
                  freePassTickets: prev.freePassTickets + nextTickets,
                  checkinDay: nextCycleDay,
                  lastCheckinDate: todayKey,
                }),
                'daily_checkin',
                {},
              )
            }}
          />
        ) : path === 'library' || path === 'history' || path === 'purchases' ? (
          <MyWebtoonScreen initialTab={path} seriesList={seriesList} state={state} />
        ) : path === 'plans' ? (
          <PlansScreen state={state} authenticated={authenticated} onSuccess={refreshAuth} />
        ) : path === 'settings' ? (
          <SettingsScreen
            state={state}
            authUser={authUser}
            saveThemePreference={saveThemePreference}
            onUpdated={refreshAuth}
          />
        ) : path === 'support' || path === 'help' ? (
          <SupportScreen state={state} onUpdated={refreshAuth} />
        ) : path === 'notifications' ? (
          <NotificationsScreen
            notifications={notifications}
            onMarkAllRead={() => void markNotificationsRead()}
          />
        ) : path === 'terms' || path === 'privacy' ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-7">
            <h1 className="text-2xl font-black">
              {path === 'terms' ? 'ข้อกำหนดการใช้งาน NIVATOON' : 'นโยบายความเป็นส่วนตัว'}
            </h1>
            <p className="mt-3 text-sm leading-7 text-zinc-600">
              {path === 'terms'
                ? 'ผู้ใช้งานต้องเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ถูกต้อง การเติมเหรียญและแพ็กเกจต้องชำระผ่านพร้อมเพย์ (1709700341765) หรือทรูมันนี่ (0997353282) ชื่อบัญชี ธีรชาติ เครือวัลย์ พร้อมแนบสลิปจริงเท่านั้น'
                : 'NIVATOON ปกป้องข้อมูลบัญชีผู้ใช้ ประวัติการชำระเงิน และรหัสผ่านด้วยการเข้ารหัสและระบบ Cloud Firestore Security Rules'}
            </p>
          </div>
        ) : (
          <SupportScreen state={state} onUpdated={refreshAuth} />
        )}
      </main>
      <Footer />
    </div>
  )
}
