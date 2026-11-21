import { GoogleGenAI } from '@google/genai'
import { addSystemLog, getSystemSetting } from './app-db'

/**
 * Current Gemini API model defaults (per gemini-api-dev skill & official docs).
 */
export const GEMINI_MODELS = {
  reasoning: 'gemini-4-hydrogen',
  fastFallback: 'gemini-3.5-flash-lite',
  liteFallback: 'gemini-3.1-flash-lite',
  tts: 'gemini-3.8-flash-tts',
  image: 'gemini-nano-banana-2.1',
  decision: 'gemini-decision-1',
} as const

export function getActiveGeminiModels() {
  return {
    reasoning: getSystemSetting('gemini_model_reasoning') || GEMINI_MODELS.reasoning,
    tts: getSystemSetting('gemini_model_tts') || GEMINI_MODELS.tts,
    image: getSystemSetting('gemini_model_image') || GEMINI_MODELS.image,
    decision: getSystemSetting('gemini_model_decision') || GEMINI_MODELS.decision,
  }
}

export function getGeminiApiKey(): string | null {
  const fromAdminDb = getSystemSetting('gemini_api_key')
  if (fromAdminDb) return fromAdminDb
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
  return key.trim() ? key.trim() : null
}

/**
 * Defaults to `v1beta` for multimodal image inputs & Decisions API compatibility
 * with `@google/genai` >= 3.0.0 (`input[].type: 'image'` requires `v1beta`).
 */
export function createGeminiClient(options?: { apiVersion?: 'v1' | 'v1beta' }) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return null
  return new GoogleGenAI({
    apiKey,
    apiVersion: options?.apiVersion ?? 'v1beta',
  })
}

function isRateLimitError(err: any): boolean {
  const msg = String(err?.message || err || '')
  return msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota')
}

async function createInteractionWithModelFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  params: Omit<Parameters<GoogleGenAI['interactions']['create']>[0], 'model'>,
) {
  const candidates = Array.from(
    new Set([primaryModel, GEMINI_MODELS.fastFallback, GEMINI_MODELS.liteFallback]),
  )
  let lastErr: any = null

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i]
    try {
      return await ai.interactions.create({
        ...params,
        model,
      } as any)
    } catch (err: any) {
      lastErr = err
      if (isRateLimitError(err) && i < candidates.length - 1) {
        addSystemLog('warn', 'gemini-fallback', `Model ${model} hit 429 quota; falling back to ${candidates[i + 1]}`)
        continue
      }
      throw err
    }
  }
  throw lastErr
}

export interface TranslatedBubble {
  id: string
  speaker: string
  originalText: string
  thaiTranslation: string
  tone: string
  boxYPercent: number
  boxXPercent: number
  isSfx: boolean
}

export interface PanelTranslationResult {
  configured: boolean
  summary: string
  detectedLanguage: string
  bubbles: TranslatedBubble[]
  error?: string
}

/**
 * Uses Gemini multimodal (`v1beta` Interactions API) + automatic 429 fallback to `gemini-3.5-flash-lite`
 * to OCR speech bubbles / SFX in a comic panel and translate them to natural Thai.
 */
export async function translateComicPanelWithGemini(params: {
  imageBase64: string
  mimeType: string
  seriesTitle: string
  chapterNumber: number
}): Promise<PanelTranslationResult> {
  const ai = createGeminiClient({ apiVersion: 'v1beta' })
  if (!ai) {
    return {
      configured: false,
      summary: '',
      detectedLanguage: 'unknown',
      bubbles: [],
      error: 'MISSING_GEMINI_API_KEY',
    }
  }

  const models = getActiveGeminiModels()
  const schema = {
    type: 'object',
    properties: {
      detectedLanguage: {
        type: 'string',
        description:
          'Primary source language detected in the comic panel (e.g., Korean, Japanese, Chinese, English, Thai).',
      },
      summary: {
        type: 'string',
        description: 'Concise 1-2 sentence Thai description of what is happening visually in this panel.',
      },
      bubbles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            speaker: {
              type: 'string',
              description: 'Character or SFX label in Thai (e.g., ตัวเอก, ผู้บรรยาย, เอฟเฟกต์เสียง).',
            },
            originalText: { type: 'string', description: 'Exact text visible inside the bubble or SFX box.' },
            thaiTranslation: {
              type: 'string',
              description: 'Natural Thai manhwa/manga localization matching the tone.',
            },
            tone: {
              type: 'string',
              description: 'Emotional tone such as ตื่นเต้น, โกรธ, เย็นชา, กระซิบ, ระทึก.',
            },
            boxYPercent: { type: 'number', description: 'Approximate vertical center position from 0 to 100.' },
            boxXPercent: { type: 'number', description: 'Approximate horizontal center position from 0 to 100.' },
            isSfx: { type: 'boolean' },
          },
          required: ['id', 'speaker', 'originalText', 'thaiTranslation', 'tone', 'boxYPercent', 'boxXPercent', 'isSfx'],
        },
      },
    },
    required: ['detectedLanguage', 'summary', 'bubbles'],
  }

  try {
    const interaction = await createInteractionWithModelFallback(ai, models.reasoning, {
      system_instruction:
        'You are an expert Thai webtoon/manhwa translator and visual comic reader. Inspect every speech bubble, narration box, and SFX text in the panel image carefully. Translate Korean, Japanese, Chinese, or English text into vivid, natural Thai manga/manhwa dialogue. If text is already in Thai, refine/polish it as a Thai script reading and summarize the scene.',
      input: [
        {
          type: 'text',
          text: `Series: ${params.seriesTitle}, Episode ${params.chapterNumber}. Extract all visible text bubbles and sound effects with their approximate x/y percentages and translate them into Thai.`,
        },
        {
          type: 'image',
          data: params.imageBase64,
          mime_type: params.mimeType,
        },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema,
      },
      store: false,
    })

    const raw = interaction.output_text || '{}'
    const parsed = JSON.parse(raw)
    addSystemLog('info', 'ai-translate', `AI แปลภาพเรื่อง ${params.seriesTitle} Ep.${params.chapterNumber}`)
    return {
      configured: true,
      detectedLanguage: parsed.detectedLanguage || 'Thai',
      summary: parsed.summary || '',
      bubbles: Array.isArray(parsed.bubbles) ? parsed.bubbles : [],
    }
  } catch (err: any) {
    addSystemLog('error', 'ai-translate', `AI translate failed: ${err?.message || 'Unknown error'}`)
    return {
      configured: true,
      summary: '',
      detectedLanguage: 'unknown',
      bubbles: [],
      error: isRateLimitError(err)
        ? 'โควตา AI API ฟรีรายวันเต็มชั่วคราว (429) สามารถเปลี่ยนคีย์หรือโมเดลได้ในหน้า Admin Dashboard'
        : 'ไม่สามารถวิเคราะห์ภาพได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
    }
  }
}

/**
 * Stateful spoiler-safe "Previously On..." Recap & Lore Companion.
 */
export async function askSpoilerSafeCompanion(params: {
  seriesTitle: string
  synopsis: string
  origin: string
  genres: string[]
  currentChapter: number
  priorEpisodeTitles: Array<{ number: number; title: string }>
  question?: string
  previousInteractionId?: string
}) {
  const ai = createGeminiClient({ apiVersion: 'v1beta' })
  if (!ai) {
    return {
      configured: false,
      text: '',
      interactionId: null,
      error: 'MISSING_GEMINI_API_KEY',
    }
  }

  const models = getActiveGeminiModels()
  const safeHistory = params.priorEpisodeTitles
    .filter((e) => e.number < params.currentChapter)
    .map((e) => `- ตอนที่ ${e.number}: ${e.title}`)
    .join('\n')

  const userPrompt = params.question?.trim()
    ? params.question.trim()
    : `ช่วยสรุปเรื่องราวก่อนหน้าสำหรับคนที่กำลังจะเริ่มอ่าน "${params.seriesTitle}" ตอนที่ ${params.currentChapter} แบบกระชับ น่าตื่นเต้น และห้ามสปอยล์เนื้อหาตั้งแต่ตอนที่ ${params.currentChapter} เป็นต้นไปเด็ดขาด`

  const interaction = await createInteractionWithModelFallback(ai, models.reasoning, {
    system_instruction: `คุณคือ AI Lore Companion ประจำแพลตฟอร์ม NIVATOON ตอบเป็นภาษาไทยที่กระชับ สนุก และอ่านง่าย
ข้อมูลเรื่อง:
- ชื่อเรื่อง: ${params.seriesTitle} (${params.origin}, แนว: ${params.genres.join(', ')})
- เรื่องย่อหลัก: ${params.synopsis}
- ตอนที่ผู้อ่านกำลังอ่านอยู่: ตอนที่ ${params.currentChapter}
- ตอนก่อนหน้าที่อ่านมาแล้ว:
${safeHistory || '- ผู้ใช้กำลังเริ่มต้นที่ตอนที่ 1'}
กฎเหล็ก: ห้ามสปอยล์เหตุการณ์ตั้งแต่ตอนที่ ${params.currentChapter} เป็นต้นไปโดยเด็ดขาด หากผู้ใช้ถามถึงอนาคตให้เตือนอย่างสุภาพว่าเป็นการสปอยล์`,
    input: userPrompt,
    ...(params.previousInteractionId
      ? { previous_interaction_id: params.previousInteractionId }
      : {}),
  })

  return {
    configured: true,
    text: interaction.output_text || '',
    interactionId: interaction.id ?? null,
  }
}

/**
 * Comic-to-Voice-Drama Pipeline using `v1beta` multimodal input + `gemini-3.8-flash-tts`.
 */
export async function generateVoiceDramaFromPanel(params: {
  imageBase64?: string
  mimeType?: string
  seriesTitle: string
  chapterNumber: number
  fallbackLineText?: string
}) {
  const ai = createGeminiClient({ apiVersion: 'v1beta' })
  if (!ai) {
    return {
      configured: false,
      script: [],
      audioBase64: null,
      mimeType: null,
      error: 'MISSING_GEMINI_API_KEY',
    }
  }

  const models = getActiveGeminiModels()
  const scriptSchema = {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            speaker: { type: 'string', enum: ['Narrator', 'Protagonist'] },
            text: { type: 'string' },
            style: { type: 'string' },
          },
          required: ['speaker', 'text', 'style'],
        },
      },
    },
    required: ['lines'],
  }

  const inputBlocks: any[] = [
    {
      type: 'text',
      text: params.imageBase64
        ? `อ่านภาพหน้ามังฮวาจากเรื่อง "${params.seriesTitle}" ตอนที่ ${params.chapterNumber} แล้วเรียบเรียงเป็นบทพากย์สั้นๆ 2-3 ประโยคสำหรับผู้บรรยาย (Narrator) และตัวเอก (Protagonist) เป็นภาษาไทยที่เป็นธรรมชาติและได้อารมณ์`
        : `เรียบเรียงบทพากย์สั้นๆ 2 ประโยคสำหรับ "${params.seriesTitle}" ตอนที่ ${params.chapterNumber} จากข้อความนี้: ${params.fallbackLineText || params.seriesTitle}`,
    },
  ]

  if (params.imageBase64 && params.mimeType) {
    inputBlocks.push({
      type: 'image',
      data: params.imageBase64,
      mime_type: params.mimeType,
    })
  }

  const scriptRes = await createInteractionWithModelFallback(ai, models.reasoning, {
    input: inputBlocks,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: scriptSchema,
    },
    store: false,
  })

  const parsedScript = JSON.parse(scriptRes.output_text || '{"lines":[]}')
  const lines: Array<{ speaker: 'Narrator' | 'Protagonist'; text: string; style: string }> =
    Array.isArray(parsedScript.lines) && parsedScript.lines.length > 0
      ? parsedScript.lines
      : [{ speaker: 'Narrator', text: `${params.seriesTitle} ตอนที่ ${params.chapterNumber}`, style: 'dramatic' }]

  const hasNarrator = lines.some((l) => l.speaker === 'Narrator')
  const hasProtagonist = lines.some((l) => l.speaker === 'Protagonist')
  const useMulti = hasNarrator && hasProtagonist

  const ttsInteraction = await ai.interactions.create({
    model: models.tts,
    input: [
      {
        type: 'user_input',
        content: lines.map((line) => ({
          type: 'text' as const,
          text: line.text,
          annotations: [
            {
              type: 'speech_metadata' as const,
              speaker: line.speaker,
              style: line.style || 'expressive dramatic storytelling',
            },
          ],
        })),
      },
    ],
    response_format: { type: 'audio' },
    generation_config: useMulti
      ? {
          speech_config: {
            speakers: [
              { speaker: 'Narrator', voice: 'Schedar' },
              { speaker: 'Protagonist', voice: 'Aoede' },
            ],
          },
        }
      : {
          speech_config: [{ voice: 'Schedar' }],
        },
    store: false,
  })

  return {
    configured: true,
    script: lines,
    audioBase64: ttsInteraction.output_audio?.data ?? null,
    mimeType: ttsInteraction.output_audio?.mime_type ?? 'audio/wav',
  }
}

/**
 * Natural-language Mood & Plot Discovery via Gemini Structured Output.
 */
export async function discoverByMoodWithGemini(params: {
  query: string
  catalog: Array<{
    slug: string
    title: string
    sub: string
    origin: string
    genres: string[]
    synopsis: string
    rating: number
  }>
}) {
  const ai = createGeminiClient({ apiVersion: 'v1beta' })
  if (!ai) {
    return { configured: false, recommendations: [], error: 'MISSING_GEMINI_API_KEY' }
  }

  const models = getActiveGeminiModels()
  const schema = {
    type: 'object',
    properties: {
      recommendations: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            matchScore: { type: 'number' },
            reasonThai: { type: 'string' },
          },
          required: ['slug', 'matchScore', 'reasonThai'],
        },
      },
    },
    required: ['recommendations'],
  }

  const catalogSummary = params.catalog
    .map(
      (c) =>
        `slug="${c.slug}" | title="${c.title}" (${c.sub}) | origin=${c.origin} | genres=${c.genres.join(',')} | synopsis=${c.synopsis}`,
    )
    .join('\n')

  const interaction = await createInteractionWithModelFallback(ai, models.reasoning, {
    input: `ความต้องการของผู้อ่าน: "${params.query}"\n\nรายการเรื่องในคลัง NIVATOON:\n${catalogSummary}\n\nคัดเลือกเรื่องที่ตรงกับฟีลหรือพล็อตที่ต้องการมากที่สุด พร้อมให้คะแนน matchScore (0-100) และเหตุผลภาษาไทยที่น่าสนใจ`,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema,
    },
    store: false,
  })

  const parsed = JSON.parse(interaction.output_text || '{"recommendations":[]}')
  return {
    configured: true,
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
  }
}

/**
 * Native Webtoon Cover / Panel Art Generation via `gemini-nano-banana-2.1`.
 */
export async function generateManhwaImageWithGemini(prompt: string) {
  const ai = createGeminiClient({ apiVersion: 'v1beta' })
  if (!ai) {
    return { configured: false, imageBase64: null, mimeType: null, error: 'MISSING_GEMINI_API_KEY' }
  }

  const models = getActiveGeminiModels()
  const interaction = await ai.interactions.create({
    model: models.image,
    response_modalities: ['image'],
    input: `Vertical 3:4 Korean webtoon manhwa illustration, sharp cinematic digital linework, vibrant lighting, strictly no text, no watermarks: ${prompt}`,
    store: false,
  })

  return {
    configured: true,
    imageBase64: interaction.output_image?.data ?? null,
    mimeType: interaction.output_image?.mime_type ?? 'image/png',
  }
}

/**
 * Calibrated Spoiler & Toxicity Guard for episode comments using `gemini-decision-1` (`v1beta`).
 */
export async function moderateCommentWithGemini(params: {
  comment: string
  seriesTitle: string
  chapterNumber: number
}) {
  const ai = createGeminiClient({ apiVersion: 'v1beta' })
  if (!ai) {
    const lower = params.comment.toLowerCase()
    const looksSpoiler =
      lower.includes('สปอย') ||
      lower.includes('spoiler') ||
      lower.includes('ตอนจบ') ||
      lower.includes('ตายตอน')
    return {
      configured: false,
      isSpoiler: looksSpoiler,
      spoilerConfidence: looksSpoiler ? 0.85 : 0.1,
      isToxic: false,
    }
  }

  const models = getActiveGeminiModels()
  try {
    const result = await ai.decisions.create({
      model: models.decision,
      input: `Series: ${params.seriesTitle}, Episode ${params.chapterNumber}\nReader comment: ${params.comment}`,
      questions: {
        is_spoiler: {
          type: 'noul',
          instructions:
            'Does this comment reveal major future plot twists, character deaths, or ending spoilers beyond this episode?',
        },
        is_toxic: {
          type: 'noul',
          instructions:
            'Does this comment contain severe harassment, hate speech, or spam?',
        },
      },
    })

    const spoilerAns = result.answers?.is_spoiler
    const toxicAns = result.answers?.is_toxic

    return {
      configured: true,
      isSpoiler: spoilerAns?.type === 'noul' ? spoilerAns.noul >= 0.65 : false,
      spoilerConfidence: spoilerAns?.type === 'noul' ? spoilerAns.noul : 0,
      isToxic: toxicAns?.type === 'noul' ? toxicAns.noul >= 0.75 : false,
    }
  } catch {
    const lower = params.comment.toLowerCase()
    const looksSpoiler = lower.includes('สปอย') || lower.includes('spoiler')
    return {
      configured: true,
      isSpoiler: looksSpoiler,
      spoilerConfidence: looksSpoiler ? 0.8 : 0.1,
      isToxic: false,
    }
  }
}

export interface SlipVerificationResult {
  configured: boolean
  detectedProvider: 'promptpay' | 'truemoney' | 'bank' | 'unknown'
  detectedAmountTHB: number | null
  detectedRecipient: string
  detectedRecipientName: string
  matchesExpectedRecipient: boolean
  detectedReference: string
  looksAuthentic: boolean
  summaryThai: string
  error?: string
}

/**
 * Inspects a Thai banking PromptPay (`1709700341765`) or TrueMoney (`0997353282`) transfer slip image
 * belonging to account holder "ธีรชาติ เครือวัลย์" using Gemini `v1beta` with automatic 429 model fallback.
 */
export async function verifyPaymentSlipWithGemini(params: {
  imageBase64: string
  mimeType: string
  expectedAmountTHB: number
}): Promise<SlipVerificationResult> {
  const ai = createGeminiClient({ apiVersion: 'v1beta' })
  if (!ai) {
    return {
      configured: false,
      detectedProvider: 'unknown',
      detectedAmountTHB: null,
      detectedRecipient: '',
      detectedRecipientName: '',
      matchesExpectedRecipient: false,
      detectedReference: '',
      looksAuthentic: false,
      summaryThai: 'ระบบ AI ตรวจสลิปยังไม่ได้เชื่อมต่อ API Key',
      error: 'MISSING_GEMINI_API_KEY',
    }
  }

  const models = getActiveGeminiModels()
  const schema = {
    type: 'object',
    properties: {
      detectedProvider: {
        type: 'string',
        enum: ['promptpay', 'truemoney', 'bank', 'unknown'],
      },
      detectedAmountTHB: {
        type: 'number',
        description: 'Exact transferred THB amount visible on the slip. Use 0 if not visible.',
      },
      detectedRecipient: {
        type: 'string',
        description: 'Recipient PromptPay ID, phone number, or masked bank account visible on the slip.',
      },
      detectedRecipientName: {
        type: 'string',
        description: 'Recipient account holder name visible on the slip (e.g., ธีรชาติ เครือวัลย์ or masked Thai name).',
      },
      matchesExpectedRecipient: {
        type: 'boolean',
        description:
          'True if recipient matches Thai name "ธีรชาติ" / "เครือวัลย์" (or masked นายธีรชาติ ค. / THEERACHAT) OR PromptPay ID 1709700341765 / masked ending 1765 OR TrueMoney 0997353282 / masked ending 3282.',
      },
      detectedReference: {
        type: 'string',
        description: 'Transaction reference ID / Ref code visible on the slip (alphanumeric).',
      },
      looksAuthentic: {
        type: 'boolean',
        description:
          'True ONLY if this is genuinely a real Thai mobile banking transfer slip (K PLUS, SCB EASY, Krungthai NEXT, Bangkok Bank, Krungsri, ttb, GSB) or TrueMoney Wallet transfer receipt with clear Thai transfer details, NOT a comic page, selfie, blank picture, or random image.',
      },
      summaryThai: {
        type: 'string',
        description: 'Short clear Thai explanation of what was detected or why verification failed.',
      },
    },
    required: [
      'detectedProvider',
      'detectedAmountTHB',
      'detectedRecipient',
      'detectedRecipientName',
      'matchesExpectedRecipient',
      'detectedReference',
      'looksAuthentic',
      'summaryThai',
    ],
  }

  try {
    const interaction = await createInteractionWithModelFallback(ai, models.reasoning, {
      input: [
        {
          type: 'text',
          text: `ตรวจสอบรูปสลิปโอนเงินนี้อย่างเข้มงวด:
1) ตรวจว่าเป็น "สลิปโอนเงินจริงของธนาคารไทยหรือ TrueMoney Wallet" หรือไม่ (ถ้าเป็นภาพการ์ตูน ภาพทั่วไป รูปโปรไฟล์ หรือภาพเปล่า ให้ตอบ looksAuthentic = false ทันที)
2) ยอดเงินที่คาดหวังคือ ${params.expectedAmountTHB} บาท
3) บัญชีผู้รับปลายทางที่ถูกต้องคือ PromptPay "1709700341765" หรือ TrueMoney "0997353282" ชื่อบัญชี "ธีรชาติ เครือวัลย์" (รองรับรูปแบบเซ็นเซอร์ของธนาคาร เช่น "นาย ธีรชาติ ค.", "xxx-x-xx176-5", "xxx-xxx-3282", "THEERACHAT")
ดึงยอดเงิน เลขที่อ้างอิง ช่องทาง ผู้รับ และผลการตรวจออกมาเป็น JSON`,
        },
        {
          type: 'image',
          data: params.imageBase64,
          mime_type: params.mimeType,
        },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema,
      },
      store: false,
    })

    const parsed = JSON.parse(interaction.output_text || '{}')
    return {
      configured: true,
      detectedProvider: parsed.detectedProvider || 'unknown',
      detectedAmountTHB:
        typeof parsed.detectedAmountTHB === 'number' && parsed.detectedAmountTHB > 0
          ? parsed.detectedAmountTHB
          : null,
      detectedRecipient: parsed.detectedRecipient || '',
      detectedRecipientName: parsed.detectedRecipientName || '',
      matchesExpectedRecipient: Boolean(parsed.matchesExpectedRecipient),
      detectedReference: parsed.detectedReference || '',
      looksAuthentic: Boolean(parsed.looksAuthentic),
      summaryThai: parsed.summaryThai || '',
    }
  } catch (err: any) {
    addSystemLog('error', 'payment-ai', `Slip AI error: ${err?.message || 'Unknown error'}`)
    return {
      configured: true,
      detectedProvider: 'unknown',
      detectedAmountTHB: null,
      detectedRecipient: '',
      detectedRecipientName: '',
      matchesExpectedRecipient: false,
      detectedReference: '',
      looksAuthentic: false,
      summaryThai: isRateLimitError(err)
        ? 'ระบบ AI ตรวจสลิปติดโควตาชั่วคราว (429) กรุณารอสักครู่หรือให้แอดมินตรวจสอบ'
        : 'ไม่สามารถอ่านข้อมูลจากสลิปได้ กรุณาอัปโหลดภาพสลิปที่ชัดเจนอีกครั้ง',
      error: err?.message || 'SLIP_SCAN_FAILED',
    }
  }
}
