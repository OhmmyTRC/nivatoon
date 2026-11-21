import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { addSystemLog, getDb } from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'
import { verifyPaymentSlipWithGemini } from '@/lib/gemini'

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
  }

  try {
    const fd = await request.formData()
    const slipFile = fd.get('slip')
    const expectedAmountTHB = Number(fd.get('expectedAmountTHB') || 0)

    if (!slipFile || !(slipFile instanceof File) || slipFile.size === 0) {
      return NextResponse.json({ ok: false, error: 'กรุณาเลือกไฟล์ภาพสลิป' }, { status: 400 })
    }

    const buf = Buffer.from(await slipFile.arrayBuffer())
    const slipHash = crypto.createHash('sha256').update(buf).digest('hex')

    const dupSlip = getDb()
      .prepare('SELECT id FROM wallet_transactions WHERE slip_hash = ? LIMIT 1')
      .get(slipHash) as { id: string } | undefined

    if (dupSlip) {
      addSystemLog('warn', 'payment', `พบสลิปซ้ำระหว่างสแกนโดย ${user.email}`, user.email)
      return NextResponse.json(
        {
          ok: false,
          duplicate: true,
          error: 'สลิปนี้ถูกใช้ชำระเงินในระบบไปแล้ว กรุณาใช้สลิปการโอนรายการใหม่',
        },
        { status: 409 },
      )
    }

    const mimeType = slipFile.type || 'image/jpeg'
    const base64 = buf.toString('base64')
    const scan = await verifyPaymentSlipWithGemini({
      imageBase64: base64,
      mimeType,
      expectedAmountTHB: Number.isFinite(expectedAmountTHB) && expectedAmountTHB > 0 ? expectedAmountTHB : 1,
    })

    if (!scan.configured) {
      return NextResponse.json({
        ok: false,
        configured: false,
        error: 'ระบบตรวจสอบสลิปยังไม่ได้ตั้งค่า API Key กรุณาติดต่อแอดมิน',
      }, { status: 400 })
    }

    const autoRef =
      scan.detectedReference?.trim() ||
      `SLP-${slipHash.slice(0, 8).toUpperCase()}`

    if (!scan.looksAuthentic) {
      addSystemLog('warn', 'payment', `สลิปไม่ผ่านการตรวจสอบเบื้องต้น (${user.email}): ${scan.summaryThai}`, user.email)
      return NextResponse.json({
        ok: false,
        looksAuthentic: false,
        suggestedReference: autoRef,
        detectedAmountTHB: scan.detectedAmountTHB,
        detectedRecipientName: scan.detectedRecipientName,
        error: scan.summaryThai || 'ภาพนี้ไม่ใช่สลิปโอนเงินที่ถูกต้อง กรุณาอัปโหลดสลิปโอนเงินจริง',
      })
    }

    return NextResponse.json({
      ok: true,
      looksAuthentic: true,
      suggestedReference: autoRef,
      detectedProvider: scan.detectedProvider,
      detectedAmountTHB: scan.detectedAmountTHB,
      detectedRecipient: scan.detectedRecipient,
      detectedRecipientName: scan.detectedRecipientName,
      matchesExpectedRecipient: scan.matchesExpectedRecipient,
      summaryThai: scan.summaryThai,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'สแกนสลิปไม่สำเร็จ' }, { status: 500 })
  }
}
