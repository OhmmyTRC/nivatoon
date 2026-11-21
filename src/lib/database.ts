export interface EpisodeFileRecord {
  id: string
  dir: string
  chapterNumber: number
  title: string
  coinPrice: number
  isPreview: boolean
  publishedAt: string
  pages: string[]
}

export interface ComicSeriesRecord {
  id: string
  slug: string
  folder: string
  title: string
  sub: string
  synopsis: string
  author: string
  origin: 'korea' | 'china' | 'japan'
  status: 'ongoing' | 'completed' | 'hiatus'
  genres: string[]
  rating: number
  views: string
  followers: string
  tone: string
  latestChapter: number
  badge: string
  updateDay: string
  coverUrl: string | null
  episodes: EpisodeFileRecord[]
  isCustomFolder?: boolean
}

export interface ChapterRecord {
  id: string
  dir: string
  seriesSlug: string
  chapterNumber: number
  title: string
  coinPrice: number
  isPreview: boolean
  publishedAt: string
  pages: string[]
  panels: string[]
}

export interface WalletTxRecord {
  id: string
  reference: string
  title: string
  type: 'topup' | 'purchase' | 'refund' | 'bonus'
  coins: number
  amountTHB: number
  status: 'pending' | 'completed' | 'failed'
  provider: string
  dateLabel: string
}

export interface EpisodeCommentRecord {
  id: string
  seriesSlug: string
  chapterNumber: number
  author: string
  avatarBadge: string
  text: string
  likes: number
  isTop?: boolean
  isSpoiler?: boolean
  createdAt: string
}

export const FIREBASE_PROJECT_ID = 'niva-421c2'
export const FIREBASE_PROJECT_NUMBER = '723356596295'

export const STARTER_SERIES: ComicSeriesRecord[] = [
  {
    id: 'series-1',
    slug: 'moonlit-sword',
    folder: '01-moonlit-sword',
    title: 'ดาบจันทราเหนือมหานคร',
    sub: 'MOONLIT SWORD',
    synopsis:
      'มหานครที่ไม่มีใครเคยเห็นดวงจันทร์มานานร้อยปี จนกระทั่งคืนหนึ่ง “ยูนา” เด็กส่งของชั้นล่างสุดพบดาบโบราณที่ตอบสนองต่อแสงจันทร์ในความทรงจำของเธอ เธอจึงต้องเลือกระหว่างการแก้แค้นกับการปกป้องเมืองสุดท้าย',
    author: 'HANA STUDIO',
    origin: 'korea',
    status: 'ongoing',
    genres: ['fantasy', 'action'],
    rating: 4.9,
    views: '18.4M อ่าน',
    followers: '382K ติดตาม',
    tone: 'from-emerald-300 to-slate-900',
    latestChapter: 3,
    badge: 'HOT',
    updateDay: 'ศุกร์',
    coverUrl: '/comics/01-moonlit-sword/cover.jpg',
    episodes: [],
  },
  {
    id: 'series-2',
    slug: 'palace-bloom',
    folder: '02-palace-bloom',
    title: 'บุปผาแห่งวังหลวง',
    sub: 'THE PALACE BLOOM',
    author: 'MEI LIN ART',
    synopsis:
      'ท่ามกลางศึกชิงบัลลังก์และแผนลอบสังหารในราชสำนัก หมอยาหญิงผู้ซ่อนพิษไว้ในกลีบดอกไม้ต้องใช้ไหวพริบพลิกชะตากรรมของตนเองและองค์รัชทายาท',
    origin: 'china',
    status: 'ongoing',
    genres: ['romance', 'historical', 'drama'],
    rating: 4.8,
    views: '12.1M อ่าน',
    followers: '295K ติดตาม',
    tone: 'from-rose-300 to-red-950',
    latestChapter: 3,
    badge: 'ใหม่',
    updateDay: 'พุธ',
    coverUrl: '/comics/02-palace-bloom/cover.jpg',
    episodes: [],
  },
  {
    id: 'series-3',
    slug: 'unrivaled-system',
    folder: '03-unrivaled-system',
    title: 'ระบบเทพไร้พ่าย',
    sub: 'UNRIVALED SYSTEM',
    synopsis:
      'เมื่อดันเจี้ยนระดับ S ปะทุขึ้นใจกลางกรุงโซล เด็กหนุ่มผู้ถูกทอดทิ้งกลับปลุกหน้าต่างระบบปริศนาที่เปลี่ยนทุกบาดแผลให้กลายเป็นค่าสถานะระดับเทพ',
    author: 'KANG JIN & REDICE',
    origin: 'korea',
    status: 'ongoing',
    genres: ['action', 'fantasy'],
    rating: 4.9,
    views: '24.7M อ่าน',
    followers: '510K ติดตาม',
    tone: 'from-amber-300 to-stone-900',
    latestChapter: 3,
    badge: 'TOP 1',
    updateDay: 'เสาร์',
    coverUrl: '/comics/03-unrivaled-system/cover.jpg',
    episodes: [],
  },
  {
    id: 'series-4',
    slug: 'reborn-as-demon',
    folder: '04-reborn-as-demon',
    title: 'เมื่อฉันเกิดใหม่เป็นจอมมาร',
    sub: 'REBORN AS DEMON',
    synopsis:
      'ผู้กล้าที่สละชีวิตปราบจอมมารสำเร็จ กลับลืมตาตื่นขึ้นมาในร่างของจอมมารรุ่นถัดไป พร้อมลูกน้องปีศาจสุดเพี้ยนที่พยายามให้เขายึดครองโลกอีกครั้ง',
    author: 'TAKAHASHI REN',
    origin: 'japan',
    status: 'completed',
    genres: ['fantasy', 'comedy', 'action'],
    rating: 4.7,
    views: '9.8M อ่าน',
    followers: '210K ติดตาม',
    tone: 'from-violet-300 to-indigo-950',
    latestChapter: 3,
    badge: 'จบแล้ว',
    updateDay: 'อาทิตย์',
    coverUrl: '/comics/04-reborn-as-demon/cover.jpg',
    episodes: [],
  },
  {
    id: 'series-5',
    slug: 'letter-from-tomorrow',
    folder: '05-letter-from-tomorrow',
    title: 'จดหมายรักจากอนาคต',
    sub: 'LETTER FROM TOMORROW',
    synopsis:
      'ตู้ไปรษณีย์เก่าริมสถานีรถไฟส่งจดหมายที่ลงวันที่ในอีก 10 ปีข้างหน้ามาถึงมือเธอ เพื่อเตือนไม่ให้เธอปล่อยมือจากคนสำคัญในฤดูฝนปีนี้',
    author: 'AOI SORA',
    origin: 'japan',
    status: 'completed',
    genres: ['romance', 'drama'],
    rating: 4.8,
    views: '11.3M อ่าน',
    followers: '340K ติดตาม',
    tone: 'from-sky-200 to-cyan-950',
    latestChapter: 3,
    badge: 'จบแล้ว',
    updateDay: 'พฤหัสบดี',
    coverUrl: '/comics/05-letter-from-tomorrow/cover.jpg',
    episodes: [],
  },
  {
    id: 'series-6',
    slug: 'rank-zero-hunter',
    folder: '06-rank-zero-hunter',
    title: 'นักล่าแรงก์ศูนย์',
    sub: 'RANK ZERO HUNTER',
    synopsis:
      'ในโลกที่ฮันเตอร์ถูกวัดค่าด้วยแรงก์ A ถึง F เขาคือคนเดียวที่เครื่องวัดแสดงผลเป็น “แรงก์ 0” ซึ่งซ่อนพลังดูดกลืนมอนสเตอร์ระดับภัยพิบัติไว้',
    author: 'STUDIOAPEX',
    origin: 'korea',
    status: 'ongoing',
    genres: ['action', 'fantasy'],
    rating: 4.7,
    views: '15.6M อ่าน',
    followers: '318K ติดตาม',
    tone: 'from-lime-300 to-green-950',
    latestChapter: 3,
    badge: 'HOT',
    updateDay: 'อาทิตย์',
    coverUrl: '/comics/06-rank-zero-hunter/cover.jpg',
    episodes: [],
  },
]

export function generateChaptersForSeries(series: ComicSeriesRecord): ChapterRecord[] {
  if (series.episodes && series.episodes.length > 0) {
    return [...series.episodes]
      .sort((a, b) => b.chapterNumber - a.chapterNumber)
      .map((ep) => ({
        id: ep.id,
        dir: ep.dir,
        seriesSlug: series.slug,
        chapterNumber: ep.chapterNumber,
        title: ep.title,
        coinPrice: ep.coinPrice,
        isPreview: ep.isPreview,
        publishedAt: ep.publishedAt,
        pages: ep.pages,
        panels: ep.pages,
      }))
  }

  const latest = series.latestChapter || 3
  return Array.from({ length: Math.min(10, Math.max(3, latest)) }, (_, idx) => {
    const chNum = latest - idx
    const isFree = idx >= 1
    return {
      id: `${series.slug}-ep-${chNum}`,
      dir: `ep-${String(chNum).padStart(2, '0')}`,
      seriesSlug: series.slug,
      chapterNumber: chNum,
      title: `บทที่ ${chNum}`,
      coinPrice: isFree ? 0 : 5,
      isPreview: idx === 0,
      publishedAt: `${idx + 1} วันที่แล้ว`,
      pages: [],
      panels: [
        `“ถ้าดวงจันทร์กลับมา เมืองนี้จะไม่เหมือนเดิมอีกต่อไป” — ${series.title} ตอนที่ ${chNum}`,
      ],
    }
  })
}

export const STARTER_COMMENTS: EpisodeCommentRecord[] = [
  {
    id: 'c-1',
    seriesSlug: 'moonlit-sword',
    chapterNumber: 1,
    author: 'KuroNekoTH',
    avatarBadge: 'LV.18',
    text: 'งานภาพฉากฝนตกกับดาบสีมรกตคือที่สุด! ยิ่งเปิด AI แปลคำพูดเกาหลีในหน้า 2 ยิ่งได้ฟีลเหมือนอ่านตอนปล่อยจากเกาหลีเลยครับ',
    likes: 1420,
    isTop: true,
    createdAt: '2 ชั่วโมงที่แล้ว',
  },
  {
    id: 'c-2',
    seriesSlug: 'moonlit-sword',
    chapterNumber: 1,
    author: 'SoraReader',
    avatarBadge: 'PLUS',
    text: 'ชอบตรงที่ตอนแรกมีบทพูดต้นฉบับให้ลองกดปุ่ม AI แปลภาษาด้วย ใครขี้เกียจเลื่อนกด Auto-Scroll + Voice Drama เพลินมาก',
    likes: 892,
    isTop: true,
    createdAt: '4 ชั่วโมงที่แล้ว',
  },
  {
    id: 'c-3',
    seriesSlug: 'moonlit-sword',
    chapterNumber: 1,
    author: 'SpoilerHunter99',
    avatarBadge: 'LV.4',
    text: 'สปอยล์ตอนจบของภาคนี้นะครับ จริงๆ แล้วยูนาคือผู้บัญชาการหน่วยศูนย์ที่ถูกหัวหน้าหอคอยลบความจำเองในตอนที่ 3!',
    likes: 45,
    isSpoiler: true,
    createdAt: '1 วันที่แล้ว',
  },
]
