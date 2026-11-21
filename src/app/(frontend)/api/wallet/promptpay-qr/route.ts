import { NextResponse } from 'next/server'
import {
  COIN_PACKAGES,
  findPaymentPackageById,
  generatePromptPayQrDataUrl,
  PLUS_PACKAGE,
  PROMPTPAY_ACCOUNT_NAME,
  PROMPTPAY_RECIPIENT_ID,
  TRUEMONEY_ACCOUNT_NAME,
  TRUEMONEY_RECIPIENT_ID,
} from '@/lib/promptpay'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const packageId = url.searchParams.get('packageId')?.trim() || ''
  const matchedPkg = packageId ? findPaymentPackageById(packageId) : undefined
  const amount = matchedPkg
    ? matchedPkg.priceTHB
    : Number(url.searchParams.get('amount') || 35)
  const validAmount = Number.isFinite(amount) && amount > 0 ? amount : 35

  const { payload, qrDataUrl } = await generatePromptPayQrDataUrl(validAmount, PROMPTPAY_RECIPIENT_ID)
  return NextResponse.json({
    ok: true,
    recipientId: PROMPTPAY_RECIPIENT_ID,
    accountName: PROMPTPAY_ACCOUNT_NAME,
    truemoneyRecipientId: TRUEMONEY_RECIPIENT_ID,
    truemoneyAccountName: TRUEMONEY_ACCOUNT_NAME,
    amountTHB: validAmount,
    payload,
    qrDataUrl,
    packages: COIN_PACKAGES,
    plusPackage: PLUS_PACKAGE,
  })
}
