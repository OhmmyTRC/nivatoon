import { NextResponse } from 'next/server'
import {
  FIREBASE_PROJECT_ID,
  FIREBASE_PROJECT_NUMBER,
} from '@/lib/database'
import { fetchSeriesFromDatabase } from '@/lib/database-server'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { series, source } = await fetchSeriesFromDatabase()
  return NextResponse.json({
    ok: true,
    database: {
      provider: source,
      firebaseProjectId: FIREBASE_PROJECT_ID,
      firebaseProjectNumber: FIREBASE_PROJECT_NUMBER,
      collections: [
        'users',
        'series',
        'chapters',
        'library',
        'reading-progress',
        'purchases',
        'wallet-transactions',
      ],
    },
    series,
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, payload: data } = body

    try {
      const payload = await getPayloadClient()
      if (action === 'topup' && data?.reference) {
        await payload.create({
          collection: 'wallet-transactions',
          overrideAccess: true,
          data: {
            reference: data.reference,
            user: data.userId || 'demo-user',
            type: 'topup',
            coins: Number(data.coins || 0),
            amountTHB: Number(data.amountTHB || 0),
            status: 'completed',
            provider: data.provider || 'promptpay',
          },
        })
      }
    } catch {
      // Fallback handled client-side if Payload DB connection is inactive
    }

    return NextResponse.json({
      ok: true,
      action,
      firebaseProjectId: FIREBASE_PROJECT_ID,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 })
  }
}
