import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import {
  addSystemLog,
  getAllSystemSettingsSafe,
  setSystemSettings,
} from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'
import { sendSmtpTestEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { session, user } = await getServerSession()
  if (!session || !user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden: Admin only' }, { status: 403 })
  }

  let rulesMarkdown = ''
  try {
    const mdPath = path.join(process.cwd(), 'CONFIG_RULES.md')
    if (fs.existsSync(mdPath)) {
      rulesMarkdown = fs.readFileSync(mdPath, 'utf8')
    }
  } catch {}

  return NextResponse.json({
    ok: true,
    settings: getAllSystemSettingsSafe(),
    rulesMarkdown,
  })
}

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden: Admin only' }, { status: 403 })
  }

  try {
    const body = await request.json()

    if (body.action === 'test_smtp') {
      const testTo = String(body.testTo || user.email).trim()
      if (!testTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) {
        return NextResponse.json({ ok: false, error: 'กรุณากรอกอีเมลปลายทางสำหรับทดสอบให้ถูกต้อง' }, { status: 400 })
      }
      const res = await sendSmtpTestEmail(testTo)
      if (!res.sent) {
        addSystemLog('error', 'admin-settings', `ทดสอบส่งอีเมล SMTP ไม่สำเร็จ: ${res.rawError || res.error}`, user.email)
        return NextResponse.json({ ok: false, error: res.error || 'ทดสอบส่งเมลไม่สำเร็จ' }, { status: 400 })
      }
      addSystemLog('info', 'admin-settings', `ทดสอบส่งอีเมล SMTP ไปยัง ${testTo} สำเร็จ`, user.email)
      return NextResponse.json({ ok: true, message: `ส่งอีเมลทดสอบไปยัง ${testTo} เรียบร้อยแล้ว ✓` })
    }

    const updates: Record<string, string | undefined> = {}

    if (typeof body.geminiApiKey === 'string' && body.geminiApiKey.trim()) {
      updates.gemini_api_key = body.geminiApiKey.trim()
    }
    if (body.clearGeminiApiKey === true) {
      updates.gemini_api_key = ''
    }
    if (typeof body.geminiModelReasoning === 'string' && body.geminiModelReasoning.trim()) {
      updates.gemini_model_reasoning = body.geminiModelReasoning.trim()
    }
    if (typeof body.geminiModelTts === 'string' && body.geminiModelTts.trim()) {
      updates.gemini_model_tts = body.geminiModelTts.trim()
    }
    if (typeof body.geminiModelImage === 'string' && body.geminiModelImage.trim()) {
      updates.gemini_model_image = body.geminiModelImage.trim()
    }
    if (typeof body.geminiModelDecision === 'string' && body.geminiModelDecision.trim()) {
      updates.gemini_model_decision = body.geminiModelDecision.trim()
    }
    if (typeof body.smtpHost === 'string') updates.smtp_host = body.smtpHost.trim()
    if (typeof body.smtpPort === 'string') updates.smtp_port = body.smtpPort.trim()
    if (typeof body.smtpUser === 'string') updates.smtp_user = body.smtpUser.trim()
    if (typeof body.smtpFrom === 'string') updates.smtp_from = body.smtpFrom.trim()
    if (typeof body.smtpPass === 'string' && body.smtpPass.trim()) {
      const hostVal = (typeof body.smtpHost === 'string' ? body.smtpHost : updates.smtp_host || 'smtp.gmail.com').toLowerCase()
      const rawPass = body.smtpPass.trim()
      updates.smtp_pass = hostVal.includes('gmail') ? rawPass.replace(/\s+/g, '') : rawPass
    }
    if (typeof body.strictSlipCheck === 'boolean') {
      updates.strict_slip_check = body.strictSlipCheck ? 'true' : 'false'
    }

    setSystemSettings(updates)
    addSystemLog('security', 'admin-settings', `แอดมินอัปเดตการตั้งค่า AI / Email / Payment Rules`, user.email)

    return NextResponse.json({
      ok: true,
      settings: getAllSystemSettingsSafe(),
      message: 'บันทึกการตั้งค่าระบบและ AI เรียบร้อยแล้ว',
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Save failed' }, { status: 500 })
  }
}
