import nodemailer from 'nodemailer'
import { getSystemSetting } from './app-db'

function resolveSmtpConfig() {
  const host = (getSystemSetting('smtp_host') || process.env.SMTP_HOST || 'smtp.gmail.com').trim()
  const port = Number(getSystemSetting('smtp_port') || process.env.SMTP_PORT || 587)
  const user = (getSystemSetting('smtp_user') || process.env.SMTP_USER || '').trim()
  const rawPass = (getSystemSetting('smtp_pass') || process.env.SMTP_PASS || '').trim()
  // Google displays 16-char App Passwords with spaces ("xxxx xxxx xxxx xxxx"); normalize cleanly for Gmail
  const pass = host.toLowerCase().includes('gmail') ? rawPass.replace(/\s+/g, '') : rawPass
  const savedFrom = (getSystemSetting('smtp_from') || process.env.SMTP_FROM || '').trim()
  const from =
    savedFrom && !savedFrom.includes('no-reply@nivatoon.app')
      ? savedFrom
      : user
        ? `NIVATOON <${user}>`
        : 'NIVATOON <no-reply@nivatoon.app>'

  return { host, port, user, pass, from }
}

export function formatSmtpErrorThai(err: any): string {
  const raw = String(err?.message || err || '')
  if (
    raw.includes('535-5.7.8') ||
    raw.includes('BadCredentials') ||
    raw.includes('Username and Password not accepted') ||
    raw.includes('Invalid login')
  ) {
    return 'เข้าสู่ระบบ Gmail SMTP ไม่สำเร็จ (535-5.7.8): Google ไม่อนุญาตให้ใช้รหัสผ่านบัญชี Gmail ปกติในการส่งอีเมล — แอดมินต้องเปิด 2-Step Verification และสร้าง App Password 16 หลัก ที่ myaccount.google.com/apppasswords มาใส่ในหน้า Admin Dashboard → ตั้งค่า SMTP แทน'
  }
  if (raw.includes('EAUTH') || raw.includes('534-5.7.9') || raw.includes('Application-specific password')) {
    return 'บัญชีอีเมลต้องเปิดใช้ App Password (รหัสผ่านสำหรับแอป 16 หลัก) ในการตั้งค่าความปลอดภัย Google Account จึงจะส่งอีเมลผ่านระบบได้'
  }
  if (raw.includes('ECONNREFUSED') || raw.includes('ETIMEDOUT') || raw.includes('ENOTFOUND')) {
    return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ SMTP ได้ กรุณาตรวจสอบ SMTP Host / Port (เช่น smtp.gmail.com พอร์ต 587 หรือ 465)'
  }
  return raw || 'ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า SMTP ในหน้า Admin'
}

export function isSmtpConfigured(): boolean {
  const { user, pass } = resolveSmtpConfig()
  return Boolean(user && pass)
}

function createMailerTransport(cfg: ReturnType<typeof resolveSmtpConfig>) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    requireTLS: cfg.port === 587,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 12000,
    greetingTimeout: 10000,
  })
}

export async function sendPasswordResetCodeEmail(params: {
  toEmail: string
  displayName: string
  code: string
}): Promise<{ configured: boolean; sent: boolean; error?: string; rawError?: string }> {
  const cfg = resolveSmtpConfig()
  if (!cfg.user || !cfg.pass) {
    return { configured: false, sent: false }
  }

  try {
    const transporter = createMailerTransport(cfg)
    await transporter.sendMail({
      from: cfg.from,
      to: params.toEmail,
      subject: `[NIVATOON] รหัสยืนยัน 6 หลักสำหรับรีเซ็ตรหัสผ่าน: ${params.code}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e4e4e7;border-radius:16px;background:#ffffff">
          <div style="display:inline-block;background:#00dc64;color:#ffffff;font-weight:900;padding:6px 12px;border-radius:8px;font-size:14px">NIVATOON</div>
          <h2 style="margin:16px 0 8px;color:#09090b;font-size:20px">รหัสกู้คืนรหัสผ่าน 6 หลัก</h2>
          <p style="color:#52525b;font-size:14px;line-height:1.6">สวัสดีคุณ <b>${params.displayName}</b><br/>กรุณานำรหัส 6 หลักด้านล่างไปกรอกในหน้ากู้คืนรหัสผ่านภายใน 15 นาที:</p>
          <div style="margin:20px 0;padding:18px;text-align:center;background:#f4f4f5;border-radius:12px;font-family:monospace;font-size:32px;font-weight:900;letter-spacing:10px;color:#09090b">${params.code}</div>
          <p style="color:#71717a;font-size:12px">หากคุณไม่ได้เป็นผู้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้และตรวจสอบความปลอดภัยบัญชีของคุณ</p>
        </div>
      `,
    })

    return { configured: true, sent: true }
  } catch (err: any) {
    return {
      configured: true,
      sent: false,
      error: formatSmtpErrorThai(err),
      rawError: err?.message || 'SMTP error',
    }
  }
}

export async function sendSmtpTestEmail(
  toEmail: string,
): Promise<{ configured: boolean; sent: boolean; error?: string; rawError?: string }> {
  const cfg = resolveSmtpConfig()
  if (!cfg.user || !cfg.pass) {
    return {
      configured: false,
      sent: false,
      error: 'ยังไม่ได้กรอก SMTP User และ App Password 16 หลัก',
    }
  }

  try {
    const transporter = createMailerTransport(cfg)
    await transporter.verify()
    await transporter.sendMail({
      from: cfg.from,
      to: toEmail,
      subject: '[NIVATOON] ทดสอบการเชื่อมต่อระบบส่งอีเมล SMTP สำเร็จ ✓',
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e4e4e7;border-radius:16px;background:#ffffff">
          <div style="display:inline-block;background:#00dc64;color:#ffffff;font-weight:900;padding:6px 12px;border-radius:8px;font-size:14px">NIVATOON</div>
          <h2 style="margin:16px 0 8px;color:#09090b;font-size:18px">เชื่อมต่อ SMTP Gmail สำเร็จ!</h2>
          <p style="color:#52525b;font-size:13px;line-height:1.6">อีเมลผู้ส่ง <b>${cfg.user}</b> พร้อมส่งรหัสกู้คืน OTP 6 หลักให้สมาชิกแล้ว</p>
        </div>
      `,
    })
    return { configured: true, sent: true }
  } catch (err: any) {
    return {
      configured: true,
      sent: false,
      error: formatSmtpErrorThai(err),
      rawError: err?.message || 'SMTP test error',
    }
  }
}
