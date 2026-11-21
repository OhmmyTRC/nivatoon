import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { addSystemLog, creditTopupAtomically, getSystemSetting } from '@/lib/app-db'
import { getServerSession, sanitizePublicUser } from '@/lib/auth'
import { syncDocToFirebase } from '@/lib/firebase-db'
import { verifyPaymentSlipWithGemini } from '@/lib/gemini'
import {
  findPaymentPackageById,
  PROMPTPAY_ACCOUNT_NAME,
  PROMPTPAY_RECIPIENT_ID,
  TRUEMONEY_ACCOUNT_NAME,
  TRUEMONEY_RECIPIENT_ID,
} from '@/lib/promptpay'

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json(
      { ok: false, error: 'กรุณาเข้าสู่ระบบก่อนทำการชำระเงิน' },
      { status: 401 },
    )
  }

  try {
    const fd = await request.formData()
    const packageId = String(fd.get('packageId') || '')
    const provider = (fd.get('provider') === 'truemoney' ? 'truemoney' : 'promptpay') as
      | 'promptpay'
      | 'truemoney'
    const referenceInput = String(fd.get('reference') || '').trim()
    const trueMoneyGiftUrl = String(fd.get('trueMoneyGiftUrl') || '').trim()
    const slipFile = fd.get('slip')

    const pkg = findPaymentPackageById(packageId)
    if (!pkg) {
      return NextResponse.json({ ok: false, error: 'แพ็กเกจที่เลือกไม่ถูกต้อง' }, { status: 400 })
    }

    if (!slipFile || !(slipFile instanceof File) || slipFile.size === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'กรุณาโอนเงินและอัปโหลดภาพสลิปจริงก่อนกดยืนยัน (ไม่สามารถกดข้ามการแนบสลิปได้)',
        },
        { status: 400 },
      )
    }

    const totalCoins = pkg.coins + pkg.bonusCoins
    const buf = Buffer.from(await slipFile.arrayBuffer())
    const slipHash = crypto.createHash('sha256').update(buf).digest('hex')
    const ext = slipFile.type === 'image/png' ? '.png' : '.jpg'
    const slipMime = slipFile.type || 'image/jpeg'
    const slipBase64 = buf.toString('base64')

    const slipDir = path.join(process.cwd(), 'public', 'uploads', 'slips')
    fs.mkdirSync(slipDir, { recursive: true })
    const fileName = `slip-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`
    fs.writeFileSync(path.join(slipDir, fileName), buf)
    const slipUrl = `/uploads/slips/${fileName}`

    const strictSlipCheck = (getSystemSetting('strict_slip_check') ?? 'true') !== 'false'
    const geminiSlip = await verifyPaymentSlipWithGemini({
      imageBase64: slipBase64,
      mimeType: slipMime,
      expectedAmountTHB: pkg.priceTHB,
    })

    if (!geminiSlip.configured) {
      if (strictSlipCheck) {
        addSystemLog('error', 'payment', `ปฏิเสธสลิปเนื่องจากยังไม่ตั้งค่า Gemini API Key (${user.email})`, user.email)
        return NextResponse.json(
          {
            ok: false,
            error: 'ระบบตรวจสอบสลิปอัตโนมัติยังไม่ได้เชื่อมต่อ AI API กรุณาติดต่อแอดมินตั้งค่า API ในหลังบ้าน',
          },
          { status: 400 },
        )
      }
    } else {
      if (!geminiSlip.looksAuthentic) {
        addSystemLog(
          'warn',
          'payment',
          `ปฏิเสธสลิปไม่ถูกต้อง (${user.email}, ฿${pkg.priceTHB}): ${geminiSlip.summaryThai}`,
          user.email,
        )
        return NextResponse.json(
          {
            ok: false,
            error:
              geminiSlip.summaryThai ||
              'ภาพที่อัปโหลดไม่ใช่สลิปโอนเงินที่ถูกต้อง กรุณาอัปโหลดสลิปธนาคารหรือ TrueMoney จริง',
          },
          { status: 400 },
        )
      }

      if (geminiSlip.detectedAmountTHB === null || geminiSlip.detectedAmountTHB < pkg.priceTHB) {
        const foundAmt = geminiSlip.detectedAmountTHB ?? 0
        addSystemLog(
          'warn',
          'payment',
          `ยอดโอนในสลิป (${foundAmt} ฿) น้อยกว่าแพ็กเกจ (${pkg.priceTHB} ฿) - ${user.email}`,
          user.email,
        )
        return NextResponse.json(
          {
            ok: false,
            error: `ยอดโอนในสลิป (${foundAmt} บาท) ไม่ตรงหรือน้อยกว่ายอดแพ็กเกจ (${pkg.priceTHB} บาท)`,
          },
          { status: 400 },
        )
      }

      if (strictSlipCheck && !geminiSlip.matchesExpectedRecipient) {
        addSystemLog(
          'warn',
          'payment',
          `ชื่อบัญชี/ปลายทางไม่ตรง (${geminiSlip.detectedRecipientName || geminiSlip.detectedRecipient}) - ${user.email}`,
          user.email,
        )
        return NextResponse.json(
          {
            ok: false,
            error: `บัญชีผู้รับในสลิปไม่ตรงกับชื่อ "${PROMPTPAY_ACCOUNT_NAME}" (พร้อมเพย์ ${PROMPTPAY_RECIPIENT_ID} / ทรูมันนี่ ${TRUEMONEY_RECIPIENT_ID})`,
          },
          { status: 400 },
        )
      }
    }

    const finalReference =
      referenceInput ||
      geminiSlip.detectedReference?.trim() ||
      (trueMoneyGiftUrl
        ? `TM-GIFT-${trueMoneyGiftUrl.slice(-10)}`
        : `${provider === 'promptpay' ? 'PP' : 'TM'}-${slipHash.slice(0, 8).toUpperCase()}`)

    const recipientId =
      provider === 'promptpay' ? PROMPTPAY_RECIPIENT_ID : TRUEMONEY_RECIPIENT_ID
    const recipientName =
      provider === 'promptpay' ? PROMPTPAY_ACCOUNT_NAME : TRUEMONEY_ACCOUNT_NAME

    const verificationNote = pkg.isPlanUpgrade
      ? `ชำระแพ็กเกจ NIVATOON PLUS (${pkg.priceTHB} บาท -> ${recipientName}) สำเร็จ`
      : `ยืนยันสลิป ${provider === 'promptpay' ? 'PromptPay' : 'TrueMoney'} ${recipientId} (${recipientName}) ${pkg.priceTHB} บาท`

    const result = creditTopupAtomically({
      userId: user.id,
      reference: finalReference,
      provider,
      recipientId,
      coins: totalCoins,
      amountTHB: pkg.priceTHB,
      slipUrl,
      slipHash,
      verificationNote,
      upgradeToPlus: Boolean(pkg.isPlanUpgrade),
    })

    await syncDocToFirebase('wallet_transactions', result.transaction.id, {
      ...result.transaction,
    })
    await syncDocToFirebase('users', result.user.id, {
      coinBalance: result.user.coin_balance,
      plan: result.user.plan,
      updatedAt: result.user.updated_at,
    })

    addSystemLog(
      'info',
      'payment',
      `เติมสำเร็จ ${pkg.isPlanUpgrade ? 'NIVATOON PLUS +300' : `+${totalCoins} เหรียญ`} (฿${pkg.priceTHB}) Ref:${finalReference}`,
      user.email,
    )

    return NextResponse.json({
      ok: true,
      verificationMode: geminiSlip.configured ? 'gemini-vision-verified' : 'reference-verified',
      creditedCoins: totalCoins,
      upgradedPlus: Boolean(pkg.isPlanUpgrade),
      reference: finalReference,
      transaction: result.transaction,
      user: sanitizePublicUser(result.user),
    })
  } catch (err: any) {
    if (err?.message === 'DUPLICATE_REFERENCE') {
      return NextResponse.json(
        { ok: false, error: 'เลขอ้างอิงสลิปนี้ถูกใช้งานไปแล้ว กรุณาใช้สลิปการโอนรายการใหม่' },
        { status: 409 },
      )
    }
    if (err?.message === 'DUPLICATE_SLIP') {
      return NextResponse.json(
        { ok: false, error: 'ภาพสลิปนี้ถูกใช้งานซ้ำ กรุณาอัปโหลดสลิปโอนเงินรายการใหม่' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { ok: false, error: err?.message || 'Verification failed' },
      { status: 500 },
    )
  }
}
