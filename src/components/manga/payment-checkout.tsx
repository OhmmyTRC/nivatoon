'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { CoinBadgeIcon, Icon, TicketBadgeIcon } from './icons'
import type { NivatoonUserState } from './store'
import {
  COIN_PACKAGES,
  findPaymentPackageById,
  PROMPTPAY_ACCOUNT_NAME,
  PROMPTPAY_RECIPIENT_ID,
  TRUEMONEY_ACCOUNT_NAME,
  TRUEMONEY_RECIPIENT_ID,
} from '@/lib/promptpay'

export interface PaymentModalResult {
  type: 'success' | 'error'
  title: string
  message: string
  creditedCoins?: number
  upgradedPlus?: boolean
  reference?: string
  newBalance?: number
}

export function PaymentResultModal({
  result,
  onClose,
  onRetry,
  successHref = '/',
  successCtaLabel = 'กลับไปอ่านการ์ตูน',
}: {
  result: PaymentModalResult | null
  onClose: () => void
  onRetry?: () => void
  successHref?: string
  successCtaLabel?: string
}) {
  if (!result) return null
  const isSuccess = result.type === 'success'

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-7 text-center shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-xs font-bold text-zinc-400 hover:text-zinc-900"
        >
          ปิด ✕
        </button>

        {isSuccess ? (
          <>
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-gradient-to-br from-[#00dc64] to-emerald-600 shadow-lg ring-8 ring-emerald-100">
              <CoinBadgeIcon className="size-11" />
            </div>
            <span className="mt-4 inline-block rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800">
              VERIFIED PAYMENT ✓
            </span>
            <h3 className="mt-2 text-2xl font-black text-zinc-950">{result.title}</h3>
            <p className="mt-2 text-sm text-zinc-600">{result.message}</p>

            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs">
              {typeof result.creditedCoins === 'number' && result.creditedCoins > 0 && (
                <div className="flex items-center justify-between font-black text-emerald-900">
                  <span>ได้รับเหรียญ</span>
                  <span className="text-base text-[#009944]">+{result.creditedCoins.toLocaleString()}</span>
                </div>
              )}
              {result.upgradedPlus && (
                <div className="mt-1 flex items-center justify-between font-black text-emerald-900">
                  <span>สิทธิ์แพ็กเกจ</span>
                  <span>NIVATOON PLUS ✓</span>
                </div>
              )}
              {typeof result.newBalance === 'number' && (
                <div className="mt-1 flex items-center justify-between text-zinc-600">
                  <span>เหรียญคงเหลือรวม</span>
                  <b>{result.newBalance.toLocaleString()}</b>
                </div>
              )}
              {result.reference && (
                <div className="mt-1 flex items-center justify-between text-zinc-500">
                  <span>เลขอ้างอิง</span>
                  <span className="font-mono font-bold">{result.reference}</span>
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-2">
              <Link
                href={successHref}
                onClick={onClose}
                className="rounded-full bg-[#00dc64] py-3 text-sm font-black text-white shadow-sm"
              >
                {successCtaLabel}
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-zinc-200 py-2.5 text-xs font-bold text-zinc-600"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-rose-100 text-rose-600 ring-8 ring-rose-50">
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="size-10">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5" />
                <circle cx="12" cy="16.5" r="0.8" fill="currentColor" />
              </svg>
            </div>
            <span className="mt-4 inline-block rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black text-rose-700">
              PAYMENT REJECTED
            </span>
            <h3 className="mt-2 text-xl font-black text-zinc-950">{result.title}</h3>
            <p className="mt-2 rounded-xl bg-rose-50 p-3 text-xs font-bold leading-5 text-rose-700">
              {result.message}
            </p>
            <p className="mt-2 text-[11px] text-zinc-400">
              ตรวจสอบยอดเงิน และบัญชีรับโอน &ldquo;{PROMPTPAY_ACCOUNT_NAME}&rdquo; (PromptPay {PROMPTPAY_RECIPIENT_ID} / TrueMoney {TRUEMONEY_RECIPIENT_ID})
            </p>
            <button
              type="button"
              onClick={() => {
                onClose()
                onRetry?.()
              }}
              className="mt-5 w-full rounded-full bg-zinc-950 py-3 text-sm font-black text-white"
            >
              ลองอัปโหลดสลิปใหม่อีกครั้ง
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function SlipPaymentCheckoutForm({
  packageId,
  packageTitle,
  amountTHB,
  coinsLabel,
  authenticated,
  onSuccess,
  onCancel,
}: {
  packageId: string
  packageTitle: string
  amountTHB: number
  coinsLabel: string
  authenticated: boolean
  onSuccess: (resData: any) => Promise<void> | void
  onCancel?: () => void
}) {
  const [provider, setProvider] = useState<'promptpay' | 'truemoney'>('promptpay')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const [trueMoneyGiftUrl, setTrueMoneyGiftUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState<string | null>(null)
  const [scanValid, setScanValid] = useState<boolean | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [modalResult, setModalResult] = useState<PaymentModalResult | null>(null)

  useEffect(() => {
    let cancelled = false
    setQrDataUrl(null)
    fetch(`/api/wallet/promptpay-qr?packageId=${encodeURIComponent(packageId)}&amount=${amountTHB}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.qrDataUrl) setQrDataUrl(d.qrDataUrl)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [packageId, amountTHB])

  const handleSlipSelected = async (file: File | null) => {
    setSlipFile(file)
    setScanNote(null)
    setScanValid(null)
    setReference('')
    if (!file) {
      setSlipPreview(null)
      return
    }
    setSlipPreview(URL.createObjectURL(file))
    setScanning(true)
    try {
      const fd = new FormData()
      fd.set('slip', file)
      fd.set('expectedAmountTHB', String(amountTHB))
      const res = await fetch('/api/wallet/scan-slip', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.suggestedReference) {
        setReference(data.suggestedReference)
      }
      if (!res.ok || !data.ok) {
        setScanValid(false)
        setScanNote(data.error || 'สลิปไม่ถูกต้องหรือไม่ชัดเจน กรุณาตรวจสอบอีกครั้ง')
      } else {
        setScanValid(true)
        setScanNote(
          `✓ ตรวจสลิปเบื้องต้นผ่าน (${data.detectedAmountTHB ? `฿${data.detectedAmountTHB}` : 'อ่านยอดแล้ว'}${
            data.detectedRecipientName ? ` • ผู้รับ: ${data.detectedRecipientName}` : ''
          })`,
        )
      }
    } catch {
      setScanValid(false)
      setScanNote('ไม่สามารถอ่านข้อมูลสลิปอัตโนมัติได้ กรุณาลองอัปโหลดอีกครั้ง')
    } finally {
      setScanning(false)
    }
  }

  const handleSubmitVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authenticated) {
      setModalResult({
        type: 'error',
        title: 'กรุณาเข้าสู่ระบบก่อน',
        message: 'ต้องเข้าสู่ระบบก่อนจึงจะสามารถชำระเงินและรับเหรียญได้',
      })
      return
    }
    if (!slipFile) {
      setModalResult({
        type: 'error',
        title: 'ยังไม่ได้อัปโหลดสลิปโอนเงิน',
        message: 'กรุณาโอนเงินตามยอดที่กำหนดแล้วอัปโหลดภาพสลิปจริงก่อนกดยืนยัน',
      })
      return
    }

    setVerifying(true)
    try {
      const fd = new FormData()
      fd.set('packageId', packageId)
      fd.set('provider', provider)
      if (reference.trim()) fd.set('reference', reference.trim())
      if (trueMoneyGiftUrl.trim()) fd.set('trueMoneyGiftUrl', trueMoneyGiftUrl.trim())
      fd.set('slip', slipFile)

      const res = await fetch('/api/wallet/verify-topup', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setModalResult({
          type: 'error',
          title: 'ตรวจสอบการชำระเงินไม่สำเร็จ',
          message: data.error || 'สลิปไม่ถูกต้อง ยอดไม่ตรง หรือถูกใช้งานแล้ว กรุณาลองใหม่',
        })
        return
      }

      await onSuccess(data)
      setModalResult({
        type: 'success',
        title: data.upgradedPlus ? 'เปิดใช้งาน NIVATOON PLUS สำเร็จ!' : 'เติมเหรียญสำเร็จ!',
        message: `ระบบตรวจสอบสลิปและเติมสิทธิ์เข้าบัญชีของคุณเรียบร้อยแล้ว`,
        creditedCoins: data.creditedCoins,
        upgradedPlus: data.upgradedPlus,
        reference: data.reference,
        newBalance: data.user?.coinBalance,
      })
      setSlipFile(null)
      setSlipPreview(null)
      setReference('')
    } catch {
      setModalResult({
        type: 'error',
        title: 'เชื่อมต่อไม่สำเร็จ',
        message: 'ไม่สามารถส่งข้อมูลสลิปได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
      })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <>
      <div className="grid gap-5 md:grid-cols-[330px_1fr]">
        {/* Left QR & Recipient Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center sm:p-5">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-black">
            <button
              type="button"
              onClick={() => setProvider('promptpay')}
              className={`rounded-lg py-2 ${
                provider === 'promptpay' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'
              }`}
            >
              พร้อมเพย์ QR
            </button>
            <button
              type="button"
              onClick={() => setProvider('truemoney')}
              className={`rounded-lg py-2 ${
                provider === 'truemoney' ? 'bg-[#ff6600] text-white' : 'text-zinc-500'
              }`}
            >
              TrueMoney Wallet
            </button>
          </div>

          {provider === 'promptpay' ? (
            <div className="mt-4">
              <p className="text-[11px] font-black text-[#113566]">THAI QR PROMPTPAY</p>
              <b className="mt-1 block text-3xl font-black text-[#00a84b]">฿{amountTHB.toFixed(2)}</b>
              <div className="mt-2 rounded-xl bg-zinc-50 p-2.5 text-xs">
                <p className="text-zinc-500">
                  พร้อมเพย์: <b className="font-mono text-zinc-950">{PROMPTPAY_RECIPIENT_ID}</b>
                </p>
                <p className="mt-0.5 text-zinc-600">
                  ชื่อบัญชี: <b className="text-zinc-950">{PROMPTPAY_ACCOUNT_NAME}</b>
                </p>
              </div>
              <div className="mx-auto mt-3 flex size-44 items-center justify-center rounded-xl border border-zinc-200 bg-white p-2 sm:size-48">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={`PromptPay QR ${amountTHB} บาท`} className="size-full object-contain" />
                ) : (
                  <span className="text-xs text-zinc-400">กำลังสร้าง QR ฿{amountTHB}...</span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-left">
              <div className="rounded-xl bg-[#ff6600] p-4 text-white">
                <p className="text-xs font-bold">โอนเข้า TrueMoney Wallet</p>
                <b className="mt-1 block font-mono text-2xl">{TRUEMONEY_RECIPIENT_ID}</b>
                <p className="mt-1 text-xs font-bold">ชื่อบัญชี: {TRUEMONEY_ACCOUNT_NAME}</p>
                <p className="mt-1 text-xs">ยอดชำระ ฿{amountTHB.toFixed(2)}</p>
              </div>
              <p className="text-xs leading-5 text-zinc-500">
                โอนเงินเข้าทรูมันนี่หมายเลข <b>{TRUEMONEY_RECIPIENT_ID}</b> ({TRUEMONEY_ACCOUNT_NAME}) แล้วอัปโหลดสลิปโอนเงินเพื่อยืนยันทันที
              </p>
            </div>
          )}
        </div>

        {/* Right Slip Upload + Auto Reference Verification Form */}
        <form
          onSubmit={handleSubmitVerify}
          className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-black text-[#00a84b]">{packageTitle}</p>
              <h2 className="text-lg font-black">แนบสลิปโอนเงินจริงเพื่อรับ {coinsLabel}</h2>
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-bold text-zinc-500"
              >
                ปิด
              </button>
            )}
          </div>

          <label className="grid gap-1.5 text-xs font-bold">
            1. อัปโหลดรูปสลิปโอนเงิน (จำเป็น)
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => void handleSlipSelected(e.target.files?.[0] ?? null)}
              className="rounded-xl border border-dashed border-zinc-300 p-3 text-xs"
            />
          </label>

          {slipPreview && (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <img src={slipPreview} alt="ตัวอย่างสลิป" className="size-16 rounded-lg object-cover" />
              <div className="min-w-0 flex-1 text-xs">
                <b className="block truncate">{slipFile?.name}</b>
                {scanning ? (
                  <p className="mt-1 font-bold text-amber-600">⏳ AI กำลังสแกนตรวจสอบสลิปและดึงเลขอ้างอิงอัตโนมัติ...</p>
                ) : scanNote ? (
                  <p className={`mt-1 font-bold ${scanValid ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {scanNote}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          <label className="grid gap-1 text-xs font-bold">
            2. เลขอ้างอิงสลิป (สร้าง/ดึงอัตโนมัติเมื่ออัปโหลดสลิป)
            <input
              value={reference}
              readOnly
              placeholder="ระบบจะดึงเลขอ้างอิงให้อัตโนมัติหลังอัปโหลดสลิป"
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 font-mono text-sm text-zinc-700"
            />
          </label>

          {provider === 'truemoney' && (
            <label className="grid gap-1 text-xs font-bold">
              ลิงก์อ้างอิงเพิ่มเติม (ถ้ามี)
              <input
                value={trueMoneyGiftUrl}
                onChange={(e) => setTrueMoneyGiftUrl(e.target.value)}
                placeholder="https://gift.truemoney.com/campaign/?v=..."
                className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={verifying || scanning || !slipFile}
            className="w-full rounded-xl bg-[#00dc64] py-3.5 text-sm font-black text-white shadow-sm disabled:opacity-50"
          >
            {verifying
              ? 'กำลังตรวจสอบยอดโอนจริง...'
              : scanning
                ? 'กำลังสแกนสลิป...'
                : `ยืนยันชำระเงิน ฿${amountTHB}`}
          </button>
        </form>
      </div>

      <PaymentResultModal
        result={modalResult}
        onClose={() => setModalResult(null)}
        onRetry={() => {
          setSlipFile(null)
          setSlipPreview(null)
          setReference('')
          setScanNote(null)
        }}
      />
    </>
  )
}

export function WalletContent({
  path,
  state,
  authenticated,
  initialTopupPkg,
  onSelectPackage,
  onVerifiedSuccess,
}: {
  path: string
  state: NivatoonUserState
  authenticated: boolean
  initialTopupPkg?: string
  onSelectPackage: (pkgId: string, totalCoins: number, thb: number) => void
  onVerifiedSuccess: () => Promise<void>
}) {
  const [urlPkgId, setUrlPkgId] = useState<string>(initialTopupPkg || '')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search).get('package') || ''
    if (p) setUrlPkgId(p)
  }, [path, initialTopupPkg])

  if (path === 'wallet/topup' || path === 'wallet') {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-zinc-400">ร้านค้าเหรียญ NIVATOON</p>
              <div className="mt-1 flex items-center gap-2.5 text-3xl font-black">
                <CoinBadgeIcon className="size-8" />
                {state.coinBalance.toLocaleString()}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1 font-bold text-emerald-700">
                  <TicketBadgeIcon className="size-4" /> ตั๋วอ่านฟรี {state.freePassTickets} ใบ
                </span>
                <span>• โอนเข้า {PROMPTPAY_ACCOUNT_NAME}</span>
              </div>
            </div>
            <Link
              href="/plans"
              className="w-full rounded-full border border-zinc-200 px-4 py-2 text-center text-xs font-bold text-zinc-700 sm:w-auto"
            >
              ดูแพ็กเกจ NIVATOON Plus
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
          <h2 className="text-base font-black sm:text-lg">
            เหรียญ + โบนัส (PromptPay {PROMPTPAY_RECIPIENT_ID} / TrueMoney {TRUEMONEY_RECIPIENT_ID})
          </h2>
          <div className="mt-4 divide-y divide-zinc-100">
            {COIN_PACKAGES.map((pkg) => {
              const total = pkg.coins + pkg.bonusCoins
              return (
                <div key={pkg.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50">
                      <CoinBadgeIcon className="size-7" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-base font-black">
                          {pkg.coins.toLocaleString()}
                          {pkg.bonusCoins > 0 ? `+${pkg.bonusCoins}` : ''}
                        </b>
                        {pkg.badge && (
                          <span className="rounded bg-[#00dc64] px-1.5 py-0.5 text-[10px] font-black text-white">
                            {pkg.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        รับรวม {total.toLocaleString()} พอยน์เข้าบัญชี
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectPackage(pkg.id, total, pkg.priceTHB)}
                    className="w-full rounded-xl bg-zinc-100 px-5 py-2.5 text-sm font-black text-zinc-900 hover:bg-[#00dc64] hover:text-white sm:w-auto"
                  >
                    THB {pkg.priceTHB}.00
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {state.transactions.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
            <h3 className="text-base font-black">ประวัติการเติมเหรียญและรับตั๋วล่าสุด</h3>
            <div className="mt-3 divide-y divide-zinc-100 text-xs">
              {state.transactions.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <b className="block break-words text-zinc-900">{tx.title}</b>
                    <p className="break-all text-zinc-400">
                      {tx.reference} • {tx.dateLabel}
                    </p>
                  </div>
                  <b className={`shrink-0 ${tx.coins >= 0 ? 'text-[#00a84b]' : 'text-rose-600'}`}>
                    {tx.coins === 0 ? 'ตั๋ว/ระบบ' : tx.coins > 0 ? `+${tx.coins}` : tx.coins}
                  </b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const resolvedPkg =
    (urlPkgId ? findPaymentPackageById(urlPkgId) : undefined) ??
    findPaymentPackageById(state.selectedTopupPackageId) ??
    COIN_PACKAGES[0]
  const resolvedTotalCoins = resolvedPkg.coins + resolvedPkg.bonusCoins

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs sm:p-4">
        <span className="font-black text-zinc-600">เปลี่ยนแพ็กเกจที่จะชำระ:</span>
        <div className="flex flex-wrap gap-1.5">
          {COIN_PACKAGES.map((pkg) => {
            const active = pkg.id === resolvedPkg.id
            const total = pkg.coins + pkg.bonusCoins
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => {
                  setUrlPkgId(pkg.id)
                  onSelectPackage(pkg.id, total, pkg.priceTHB)
                }}
                className={`rounded-full px-3 py-1 font-black transition ${
                  active ? 'bg-[#00dc64] text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                ฿{pkg.priceTHB} ({total})
              </button>
            )
          })}
        </div>
      </div>

      <SlipPaymentCheckoutForm
        packageId={resolvedPkg.id}
        packageTitle={`ชำระเงินเติม ${resolvedTotalCoins.toLocaleString()} เหรียญ (฿${resolvedPkg.priceTHB})`}
        amountTHB={resolvedPkg.priceTHB}
        coinsLabel={`${resolvedTotalCoins.toLocaleString()} เหรียญ`}
        authenticated={authenticated}
        onSuccess={async () => {
          await onVerifiedSuccess()
        }}
      />
    </div>
  )
}
