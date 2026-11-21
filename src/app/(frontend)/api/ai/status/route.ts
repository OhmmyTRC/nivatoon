import { NextResponse } from 'next/server'
import { getActiveGeminiModels, getGeminiApiKey } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: Boolean(getGeminiApiKey()),
    models: getActiveGeminiModels(),
  })
}
