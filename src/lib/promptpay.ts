import QRCode from 'qrcode'

export const PROMPTPAY_RECIPIENT_ID = '1709700341765'
export const PROMPTPAY_ACCOUNT_NAME = 'ธีรชาติ เครือวัลย์'
export const TRUEMONEY_RECIPIENT_ID = '0997353282'
export const TRUEMONEY_ACCOUNT_NAME = 'ธีรชาติ เครือวัลย์'

export interface CoinPackage {
  id: string
  coins: number
  bonusCoins: number
  priceTHB: number
  badge?: string
  title?: string
  isPlanUpgrade?: boolean
}

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'pkg-100', coins: 100, bonusCoins: 0, priceTHB: 35 },
  { id: 'pkg-250', coins: 250, bonusCoins: 15, priceTHB: 79 },
  { id: 'pkg-550', coins: 550, bonusCoins: 50, priceTHB: 149, badge: 'ยอดนิยม' },
  { id: 'pkg-1200', coins: 1200, bonusCoins: 150, priceTHB: 299 },
  { id: 'pkg-2600', coins: 2600, bonusCoins: 400, priceTHB: 599, badge: 'คุ้มสุด' },
  { id: 'pkg-6000', coins: 6000, bonusCoins: 1200, priceTHB: 1290 },
]

export const PLUS_PACKAGE: CoinPackage = {
  id: 'plan-plus',
  coins: 300,
  bonusCoins: 0,
  priceTHB: 129,
  badge: 'NIVATOON PLUS',
  title: 'แพ็กเกจ NIVATOON PLUS รายเดือน (+300 เหรียญ + อ่านล่วงหน้าฟรี)',
  isPlanUpgrade: true,
}

export function findPaymentPackageById(packageId: string): CoinPackage | undefined {
  if (packageId === PLUS_PACKAGE.id) return PLUS_PACKAGE
  return COIN_PACKAGES.find((p) => p.id === packageId)
}

function tlv(tag: string, value: string): string {
  const len = String(value.length).padStart(2, '0')
  return `${tag}${len}${value}`
}

/**
 * Standard CRC-16/CCITT-FALSE checksum for EMVCo Thai PromptPay QR payload.
 */
function crc16Ccitt(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Generates an EMVCo-compliant Thai PromptPay QR payload string.
 * Supports 13-digit National ID (`1709700341765`) via sub-tag `02`,
 * or 10-digit Thai mobile number (`0997353282`) via sub-tag `01`.
 */
export function buildPromptPayPayload(recipientId: string, amountTHB?: number): string {
  const digits = recipientId.replace(/\D/g, '')
  let targetTag = ''

  if (digits.length === 13) {
    targetTag = tlv('02', digits)
  } else if (digits.length === 10 && digits.startsWith('0')) {
    targetTag = tlv('01', `0066${digits.slice(1)}`)
  } else {
    targetTag = tlv('03', digits)
  }

  const merchantInfo = tlv('00', 'A000000677010111') + targetTag
  const hasAmount = typeof amountTHB === 'number' && amountTHB > 0

  const parts = [
    tlv('00', '01'),
    tlv('01', hasAmount ? '12' : '11'),
    tlv('29', merchantInfo),
    tlv('53', '764'),
    hasAmount ? tlv('54', amountTHB.toFixed(2)) : '',
    tlv('58', 'TH'),
    '6304',
  ].join('')

  return parts + crc16Ccitt(parts)
}

export async function generatePromptPayQrDataUrl(amountTHB: number, recipientId = PROMPTPAY_RECIPIENT_ID) {
  const payload = buildPromptPayPayload(recipientId, amountTHB)
  const qrDataUrl = await QRCode.toDataURL(payload, {
    width: 320,
    margin: 2,
    color: { dark: '#111111', light: '#ffffff' },
  })
  return { payload, qrDataUrl }
}
