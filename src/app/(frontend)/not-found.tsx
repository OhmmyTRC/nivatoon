import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="rounded-full bg-[#00dc64]/15 px-3.5 py-1 text-xs font-extrabold tracking-wider text-[#00a84b]">
        404 • ไม่พบหน้านี้
      </span>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
        ไม่พบเรื่องหรือหน้าที่ต้องการ
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        เนื้อหานี้อาจถูกย้ายหรือยังไม่เปิดให้บริการ กรุณากลับไปยังหน้าแรกเพื่อเลือกอ่านเรื่องยอดนิยม
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          className="rounded-full bg-[#00dc64] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#00c458]"
          href="/"
        >
          ← กลับหน้าแรก NIVATOON
        </Link>
        <Link
          className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          href="/discover"
        >
          ค้นหาเว็บตูนเรื่องอื่น
        </Link>
      </div>
    </main>
  )
}
