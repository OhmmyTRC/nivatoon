'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'
import { useNivatoonDatabase } from './store'

export function AuthPage({ mode }: { mode: string }) {
  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot-password'
  const { refreshAuth } = useNivatoonDatabase()
  const router = useRouter()

  const [tab, setTab] = useState<'login' | 'register'>(isRegister ? 'register' : 'login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)

  // Real 6-digit OTP password recovery state
  const [forgotStep, setForgotStep] = useState<'email' | 'verify' | 'done'>('email')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfoMsg(null)

    if (isForgot) {
      setLoading(true)
      try {
        if (forgotStep === 'email') {
          const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          const data = await res.json()
          if (!res.ok || !data.ok) {
            setError(data.error || 'ไม่สามารถส่งรหัสกู้คืนได้')
            return
          }
          setInfoMsg(data.message || 'ส่งรหัส CODE 6 หลักไปยังอีเมลของคุณแล้ว')
          setForgotStep('verify')
        } else if (forgotStep === 'verify') {
          if (newPassword !== confirmNewPassword) {
            setError('รหัสผ่านใหม่ทั้ง 2 ช่องไม่ตรงกัน')
            return
          }
          const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code: otpCode, newPassword }),
          })
          const data = await res.json()
          if (!res.ok || !data.ok) {
            setError(data.error || 'รหัส CODE 6 หลักไม่ถูกต้องหรือหมดอายุ')
            return
          }
          setInfoMsg(data.message || 'ตั้งรหัสผ่านใหม่สำเร็จแล้ว')
          setForgotStep('done')
        }
      } catch (err: any) {
        setError(err?.message || 'เกิดข้อผิดพลาด')
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    try {
      const endpoint = tab === 'register' ? '/api/auth/register' : '/api/auth/login'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          tab === 'register'
            ? { email, password, displayName, pin: pin || undefined }
            : { email, password },
        ),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'ไม่สามารถเข้าสู่ระบบได้')
        return
      }
      await refreshAuth()
      router.push('/security-gate')
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const quickFillAccount = (presetEmail: string, presetPass: string) => {
    setTab('login')
    setEmail(presetEmail)
    setPassword(presetPass)
    setError(null)
  }

  return (
    <main className="grid min-h-screen bg-[#f7f8f9] lg:grid-cols-[1.05fr_1fr]">
      {/* Left Brand Showcase */}
      <section className="relative hidden overflow-hidden bg-zinc-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <img
          src="/comics/01-moonlit-sword/cover.jpg"
          alt="NIVATOON"
          className="absolute inset-0 size-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/60 to-[#003b1a]/80" />

        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-2xl font-black tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-[#00dc64] text-white">
              N
            </span>
            NIVATOON
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <span className="rounded-full bg-[#00dc64] px-3 py-1 text-xs font-black text-white">
            อ่านฟรีทุกวัน
          </span>
          <h2 className="mt-4 text-5xl font-black leading-[1.08]">
            โลกมังฮวาและเว็บตูน
            <br />
            ในมือคุณ
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/75">
            เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน พร้อมระบบปลดล็อก PIN 6 หลักหรือสแกนลายนิ้วมือ
            แยกสิทธิ์นักอ่าน ครีเอเตอร์ และแอดมินอย่างปลอดภัย
          </p>
        </div>
      </section>

      {/* Right Clean Webtoon Auth Card */}
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-7 shadow-xl">
          <div className="flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2 text-xl font-black">
              <span className="grid size-8 place-items-center rounded-lg bg-[#00dc64] text-white">
                N
              </span>
              NIVATOON
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
              สมาชิกเท่านั้น
            </span>
          </div>

          {!isForgot && (
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 lg:mt-0">
              <button
                type="button"
                onClick={() => {
                  setTab('login')
                  setError(null)
                }}
                className={`rounded-lg py-2.5 text-sm font-black transition ${
                  tab === 'login' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'
                }`}
              >
                เข้าสู่ระบบ
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register')
                  setError(null)
                }}
                className={`rounded-lg py-2.5 text-sm font-black transition ${
                  tab === 'register' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'
                }`}
              >
                สมัครสมาชิก
              </button>
            </div>
          )}

          <h1 className="mt-6 text-2xl font-black text-zinc-950">
            {isForgot
              ? 'กู้คืนรหัสผ่านด้วย CODE 6 หลัก'
              : tab === 'register'
                ? 'สร้างบัญชีนักอ่านใหม่'
                : 'เข้าสู่ระบบ NIVATOON'}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            {isForgot
              ? forgotStep === 'email'
                ? 'กรอกอีเมลที่ใช้สมัครสมาชิก ระบบจะส่ง CODE ยืนยัน 6 หลักไปยังอีเมลของคุณ'
                : forgotStep === 'verify'
                  ? 'นำ CODE 6 หลักจากอีเมลมากรอกพร้อมตั้งรหัสผ่านใหม่'
                  : 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย'
              : tab === 'register'
                ? 'สมัครฟรี! รับทันที ตั๋วอ่านฟรี 3 ใบ (พอยน์เริ่มต้น 0) และสิทธิ์เช็กอินรายวัน'
                : 'กรอกอีเมลและรหัสผ่าน แล้วผ่านด่าน PIN / ลายนิ้วมือเพื่อเข้าใช้งาน'}
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}
          {infoMsg && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              {infoMsg}
            </div>
          )}

          {isForgot && forgotStep === 'done' ? (
            <div className="mt-6">
              <Link
                href="/login"
                className="block w-full rounded-xl bg-[#00dc64] py-3.5 text-center text-sm font-black text-white shadow-sm"
              >
                ไปหน้าเข้าสู่ระบบ →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 grid gap-3.5">
              {tab === 'register' && !isForgot && (
                <label className="grid gap-1 text-xs font-bold text-zinc-700">
                  ชื่อที่แสดง
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm outline-none focus:border-[#00dc64] focus:bg-white"
                    placeholder="ชื่อเล่นของคุณ"
                    required
                  />
                </label>
              )}

              <label className="grid gap-1 text-xs font-bold text-zinc-700">
                อีเมล
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isForgot && forgotStep === 'verify'}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm outline-none focus:border-[#00dc64] focus:bg-white disabled:opacity-70"
                  placeholder="name@gmail.com"
                  required
                />
              </label>

              {isForgot && forgotStep === 'verify' && (
                <>
                  <label className="grid gap-1 text-xs font-bold text-zinc-700">
                    CODE 6 หลัก (จากอีเมล)
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-center font-mono text-xl font-black tracking-[0.5em] outline-none focus:border-[#00dc64] focus:bg-white"
                      placeholder="123456"
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-zinc-700">
                    รหัสผ่านใหม่
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm outline-none focus:border-[#00dc64] focus:bg-white"
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-zinc-700">
                    ยืนยันรหัสผ่านใหม่
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm outline-none focus:border-[#00dc64] focus:bg-white"
                      placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                      required
                    />
                  </label>
                </>
              )}

              {!isForgot && (
                <label className="grid gap-1 text-xs font-bold text-zinc-700">
                  รหัสผ่าน
                  <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 focus-within:border-[#00dc64] focus-within:bg-white">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent px-3.5 py-3 text-sm outline-none"
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="px-3 text-xs font-bold text-zinc-400"
                    >
                      {showPass ? 'ซ่อน' : 'ดู'}
                    </button>
                  </div>
                </label>
              )}

              {tab === 'register' && !isForgot && (
                <label className="grid gap-1 text-xs font-bold text-zinc-700">
                  ตั้งรหัส PIN ความปลอดภัย 6 หลัก (ไม่บังคับตอนนี้)
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-center font-mono text-lg tracking-[0.5em] outline-none focus:border-[#00dc64] focus:bg-white"
                    placeholder="••••••"
                  />
                </label>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 rounded-xl bg-[#00dc64] py-3.5 text-center text-sm font-black text-white shadow-sm hover:brightness-95 disabled:opacity-50"
              >
                {loading
                  ? 'กำลังดำเนินการ...'
                  : isForgot
                    ? forgotStep === 'email'
                      ? 'ส่ง CODE 6 หลักไปยังอีเมล'
                      : 'ยืนยัน CODE และตั้งรหัสผ่านใหม่'
                    : tab === 'register'
                      ? 'สมัครสมาชิก'
                      : 'เข้าสู่ระบบ'}
              </button>
            </form>
          )}

          {!isForgot && (
            <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5">
              <p className="text-[11px] font-bold text-zinc-500">
                เลือกเติมบัญชีสำหรับทดสอบแยกยศ (1 คลิก):
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => quickFillAccount('reader@gmail.com', 'Reader2026!')}
                  className="rounded-lg border border-zinc-200 bg-white py-2 hover:border-[#00dc64]"
                >
                  👤 User ทั่วไป
                </button>
                <button
                  type="button"
                  onClick={() => quickFillAccount('creator@nivatoon.app', 'Creator2026!')}
                  className="rounded-lg border border-zinc-200 bg-white py-2 hover:border-[#00dc64]"
                >
                  🎨 Creator
                </button>
                <button
                  type="button"
                  onClick={() => quickFillAccount('admin@nivatoon.app', 'NivaAdmin2026!')}
                  className="rounded-lg border border-zinc-200 bg-zinc-900 py-2 text-[#00dc64]"
                >
                  🛡️ Admin
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-between text-xs font-bold text-zinc-500">
            {!isForgot ? (
              <Link href="/forgot-password" className="text-zinc-900 underline">
                ลืมรหัสผ่าน / รับ CODE ทางอีเมล?
              </Link>
            ) : (
              <Link href="/login" className="text-zinc-900 underline">
                ← กลับหน้าเข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export function SecurityGatePage() {
  const { authenticated, unlocked, authUser, authLoaded, refreshAuth } = useNivatoonDatabase()
  const router = useRouter()

  const [pinDigits, setPinDigits] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [setupStep, setSetupStep] = useState<'enter' | 'confirm'>('enter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [webAuthnSupported, setWebAuthnSupported] = useState(false)
  const [showChangePinBox, setShowChangePinBox] = useState(false)
  const [resetPass, setResetPass] = useState('')
  const [resetNewPin, setResetNewPin] = useState('')

  useEffect(() => {
    setWebAuthnSupported(
      typeof window !== 'undefined' &&
        Boolean(window.PublicKeyCredential && navigator.credentials),
    )
  }, [])

  useEffect(() => {
    if (authLoaded && !authenticated) {
      router.replace('/login')
    } else if (authLoaded && authenticated && unlocked) {
      router.replace('/')
    }
  }, [authLoaded, authenticated, unlocked, router])

  const needsPinSetup = Boolean(authUser && !authUser.hasPin)

  const handleDigit = (d: string) => {
    setError(null)
    if (needsPinSetup && setupStep === 'confirm') {
      if (confirmPin.length < 6) setConfirmPin((p) => p + d)
    } else {
      if (pinDigits.length < 6) setPinDigits((p) => p + d)
    }
  }

  const handleBackspace = () => {
    if (needsPinSetup && setupStep === 'confirm') {
      setConfirmPin((p) => p.slice(0, -1))
    } else {
      setPinDigits((p) => p.slice(0, -1))
    }
  }

  useEffect(() => {
    if (!authUser) return
    if (needsPinSetup) {
      if (setupStep === 'enter' && pinDigits.length === 6) {
        setSetupStep('confirm')
      } else if (setupStep === 'confirm' && confirmPin.length === 6) {
        if (pinDigits !== confirmPin) {
          setError('รหัส PIN ทั้ง 2 ครั้งไม่ตรงกัน กรุณาลองใหม่')
          setConfirmPin('')
          setPinDigits('')
          setSetupStep('enter')
          return
        }
        void submitPinAction('set_pin', pinDigits)
      }
    } else if (pinDigits.length === 6) {
      void submitPinAction('verify_pin', pinDigits)
    }
  }, [pinDigits, confirmPin, needsPinSetup, setupStep, authUser])

  const submitPinAction = async (action: 'set_pin' | 'verify_pin', pinValue: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, pin: pinValue }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'รหัส PIN ไม่ถูกต้อง')
        setPinDigits('')
        setConfirmPin('')
        setSetupStep('enter')
        return
      }
      await refreshAuth()
      router.push('/')
    } catch (err: any) {
      setError(err?.message || 'Security check failed')
    } finally {
      setLoading(false)
    }
  }

  const handleBiometricRegister = async () => {
    if (!authUser || !webAuthnSupported) return
    setLoading(true)
    setError(null)
    try {
      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'NIVATOON Security', id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(authUser.id),
            name: authUser.email,
            displayName: authUser.displayName,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null

      if (!cred) throw new Error('ยกเลิกการลงทะเบียนลายนิ้วมือ')

      const res = await fetch('/api/auth/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_biometric',
          credentialId: cred.id,
          label: 'Fingerprint / Passkey',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed')

      setStatusMsg('ลงทะเบียนสแกนลายนิ้วมือสำเร็จ!')
      await refreshAuth()
      router.push('/')
    } catch (err: any) {
      setError(
        err?.message ||
          'อุปกรณ์นี้ไม่รองรับสแกนลายนิ้วมือบนเบราว์เซอร์ กรุณาใช้รหัส PIN 6 หลัก',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleBiometricUnlock = async () => {
    if (!authUser?.biometricCredentialId || !webAuthnSupported) return
    setLoading(true)
    setError(null)
    try {
      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)
      const rawId = Uint8Array.from(
        atob(authUser.biometricCredentialId.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      )

      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [{ id: rawId, type: 'public-key' }],
          userVerification: 'required',
          timeout: 60000,
        },
      })) as PublicKeyCredential | null

      if (!assertion) throw new Error('ยกเลิกการสแกน')

      const res = await fetch('/api/auth/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_biometric',
          credentialId: assertion.id,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Verify failed')

      await refreshAuth()
      router.push('/')
    } catch (err: any) {
      setError(err?.message || 'สแกนลายนิ้วมือไม่สำเร็จ กรุณากรอก PIN 6 หลัก')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPinViaPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setStatusMsg(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: resetPass, newPin: resetNewPin }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'เปลี่ยนรหัส PIN ไม่สำเร็จ')
        return
      }
      setStatusMsg('ตั้งรหัส PIN 6 หลักใหม่สำเร็จ กำลังเข้าสู่หน้าหลัก...')
      await refreshAuth()
      router.push('/')
    } catch {
      setError('ไม่สามารถเปลี่ยนรหัส PIN ได้')
    } finally {
      setLoading(false)
    }
  }

  const activeDigits = needsPinSetup && setupStep === 'confirm' ? confirmPin : pinDigits

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8f9] px-3 py-6 sm:px-4 sm:py-10">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl sm:p-8">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-[#00dc64]/15 px-3 py-1 text-[11px] font-black text-[#009944]">
            ยืนยันความปลอดภัยก่อนเข้าแอป
          </span>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' })
              router.push('/login')
            }}
            className="text-xs font-bold text-zinc-500 underline"
          >
            เปลี่ยนบัญชี
          </button>
        </div>

        <div className="mt-6 text-center">
          <div className="mx-auto grid size-16 place-items-center overflow-hidden rounded-full bg-zinc-900 text-xl font-black text-[#00dc64] ring-4 ring-[#00dc64]/25">
            {authUser?.avatarUrl ? (
              <img src={authUser.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              (authUser?.displayName?.[0] || 'N').toUpperCase()
            )}
          </div>
          <h1 className="mt-4 text-2xl font-black text-zinc-950">
            {needsPinSetup
              ? setupStep === 'enter'
                ? 'ตั้งรหัส PIN 6 หลัก'
                : 'ยืนยันรหัส PIN อีกครั้ง'
              : 'กรอก PIN 6 หลัก หรือสแกนลายนิ้วมือ'}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">{authUser?.displayName}</p>
        </div>

        {/* 6 PIN Dots */}
        <div className="mt-6 flex justify-center gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className={`size-3.5 rounded-full border-2 transition ${
                i < activeDigits.length
                  ? 'border-[#00dc64] bg-[#00dc64]'
                  : 'border-zinc-300 bg-transparent'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mt-5 rounded-xl bg-rose-50 p-3 text-center text-xs font-bold text-rose-700">
            {error}
          </div>
        )}
        {statusMsg && (
          <div className="mt-5 rounded-xl bg-emerald-50 p-3 text-center text-xs font-bold text-emerald-700">
            {statusMsg}
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              type="button"
              key={d}
              disabled={loading}
              onClick={() => handleDigit(d)}
              className="rounded-xl bg-zinc-100 py-3.5 text-xl font-black text-zinc-900 hover:bg-zinc-200"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setPinDigits('')
              setConfirmPin('')
              setSetupStep('enter')
            }}
            className="rounded-xl bg-zinc-50 py-3.5 text-xs font-bold text-zinc-500"
          >
            ล้าง
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleDigit('0')}
            className="rounded-xl bg-zinc-100 py-3.5 text-xl font-black text-zinc-900 hover:bg-zinc-200"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="rounded-xl bg-zinc-50 py-3.5 text-xs font-bold text-zinc-500"
          >
            ⌫ ลบ
          </button>
        </div>

        <div className="mt-5 border-t border-zinc-200 pt-5">
          {authUser?.hasBiometric ? (
            <button
              type="button"
              disabled={loading || !webAuthnSupported}
              onClick={handleBiometricUnlock}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00dc64] py-3.5 text-sm font-black text-white disabled:opacity-50"
            >
              <Icon name="shield" className="size-4" />
              สแกนลายนิ้วมือ / Windows Hello
            </button>
          ) : (
            <button
              type="button"
              disabled={loading || !webAuthnSupported}
              onClick={handleBiometricRegister}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#00dc64] bg-[#00dc64]/10 py-3 text-xs font-black text-[#009944] disabled:opacity-40"
            >
              <Icon name="shield" className="size-4" />
              {webAuthnSupported
                ? 'ลงทะเบียนสแกนลายนิ้วมือเข้าใช้งาน'
                : 'อุปกรณ์นี้ใช้รหัส PIN 6 หลัก'}
            </button>
          )}

          {authUser?.hasPin && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowChangePinBox((v) => !v)
                  setError(null)
                }}
                className="text-xs font-bold text-zinc-500 underline hover:text-zinc-900"
              >
                {showChangePinBox ? 'ปิดฟอร์มเปลี่ยน PIN' : 'ลืมรหัส PIN หรือต้องการเปลี่ยน PIN ใหม่?'}
              </button>

              {showChangePinBox && (
                <form
                  onSubmit={handleResetPinViaPassword}
                  className="mt-3 space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-left"
                >
                  <p className="text-[11px] font-bold text-zinc-600">
                    ยืนยันรหัสผ่านบัญชีเพื่อตั้ง PIN 6 หลักใหม่ทันที
                  </p>
                  <input
                    type="password"
                    value={resetPass}
                    onChange={(e) => setResetPass(e.target.value)}
                    placeholder="รหัสผ่านบัญชีของคุณ"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs"
                    required
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={resetNewPin}
                    onChange={(e) => setResetNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="รหัส PIN ใหม่ 6 หลัก (ตัวเลข)"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-center font-mono text-sm tracking-[0.4em] placeholder:font-sans placeholder:tracking-normal"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading || resetNewPin.length !== 6}
                    className="w-full rounded-xl bg-zinc-950 py-2.5 text-xs font-black text-white disabled:opacity-50"
                  >
                    {loading ? 'กำลังเปลี่ยน PIN...' : 'ยืนยันเปลี่ยน PIN 6 หลัก'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
