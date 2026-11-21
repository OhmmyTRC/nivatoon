import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { addSystemLog, findUserById, getDb } from '@/lib/app-db'
import { getServerSession, sanitizePublicUser } from '@/lib/auth'
import { deleteDocFromFirebase, syncDocToFirebase } from '@/lib/firebase-db'

export async function POST(request: Request) {
  const { session, user } = await getServerSession()
  const db = getDb()
  const now = new Date().toISOString()

  try {
    const body = await request.json()
    const action = String(body.action || '')

    if (action === 'track_view') {
      const slug = String(body.seriesSlug || '').trim()
      if (slug) {
        db.prepare(`
          INSERT INTO series_stats (series_slug, views_count) VALUES (?, 1)
          ON CONFLICT(series_slug) DO UPDATE SET views_count = views_count + 1
        `).run(slug)
        const statRow = db.prepare('SELECT * FROM series_stats WHERE series_slug = ?').get(slug) as
          | Record<string, unknown>
          | undefined
        if (statRow) {
          await syncDocToFirebase('series_stats', slug, { ...statRow, updatedAt: now })
        }
      }
      return NextResponse.json({ ok: true })
    }

    if (action === 'rate_series') {
      const slug = String(body.seriesSlug || '').trim()
      const stars = Math.min(5, Math.max(1, Number(body.stars || 5)))
      if (slug) {
        db.prepare(`
          INSERT INTO series_stats (series_slug, rating_sum, rating_count) VALUES (?, ?, 1)
          ON CONFLICT(series_slug) DO UPDATE SET rating_sum = rating_sum + ?, rating_count = rating_count + 1
        `).run(slug, stars, stars)
        const statRow = db.prepare('SELECT * FROM series_stats WHERE series_slug = ?').get(slug) as
          | Record<string, unknown>
          | undefined
        if (statRow) {
          await syncDocToFirebase('series_stats', slug, { ...statRow, updatedAt: now })
        }
      }
      return NextResponse.json({ ok: true })
    }

    if (!session || !user) {
      return NextResponse.json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
    }

    let extraPayload: Record<string, unknown> = {}

    if (action === 'daily_checkin') {
      const todayKey = now.slice(0, 10)
      if (user.last_checkin_date === todayKey) {
        return NextResponse.json({ ok: false, error: 'วันนี้คุณเช็กอินรับตั๋วไปแล้ว' }, { status: 400 })
      }
      const nextDay = (Math.max(0, user.checkin_day ?? 0) % 7) + 1
      const rewardTickets = nextDay === 7 ? 3 : 1
      const txId = `tx-${crypto.randomUUID()}`
      const txRef = `CHK-D${nextDay}-${Date.now()}`
      const note = `เช็กอินวันที่ ${nextDay}/7 รับตั๋วอ่านฟรี +${rewardTickets} ใบ`

      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(
          'UPDATE users SET free_pass_tickets = free_pass_tickets + ?, checkin_day = ?, last_checkin_date = ?, updated_at = ? WHERE id = ?',
        ).run(rewardTickets, nextDay, todayKey, now, user.id)
        db.prepare(`
          INSERT INTO wallet_transactions (id, reference, user_id, provider, type, coins, amount_thb, status, verification_note, created_at)
          VALUES (?, ?, ?, 'system', 'ticket_bonus', 0, 0, 'completed', ?, ?)
        `).run(txId, txRef, user.id, note, now)
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }

      await syncDocToFirebase('wallet_transactions', txId, {
        id: txId,
        reference: txRef,
        user_id: user.id,
        provider: 'system',
        recipient_id: '1709700341765',
        type: 'ticket_bonus',
        coins: 0,
        amount_thb: 0,
        status: 'completed',
        verification_note: note,
        created_at: now,
      })
      addSystemLog('info', 'checkin', `${user.email} ${note}`, user.email)
      extraPayload = { rewardTickets, checkinDay: nextDay, note }
    } else if (action === 'toggle_library') {
      const slug = String(body.seriesSlug || '').trim()
      if (slug) {
        const exists = db
          .prepare('SELECT 1 FROM library_items WHERE user_id = ? AND series_slug = ?')
          .get(user.id, slug)
        if (exists) {
          db.prepare('DELETE FROM library_items WHERE user_id = ? AND series_slug = ?').run(user.id, slug)
          await deleteDocFromFirebase('library_items', `${user.id}_${slug}`)
        } else {
          db.prepare('INSERT INTO library_items (user_id, series_slug, notifications) VALUES (?, ?, 1)').run(
            user.id,
            slug,
          )
          await syncDocToFirebase('library_items', `${user.id}_${slug}`, {
            user_id: user.id,
            series_slug: slug,
            notifications: 1,
          })
        }
      }
    } else if (action === 'save_reading_progress') {
      const slug = String(body.seriesSlug || '').trim()
      const chapterNumber = Number(body.chapterNumber || 1)
      const percent = Math.min(100, Math.max(0, Number(body.percent || 0)))
      const page = Math.max(1, Number(body.page || 1))
      if (slug) {
        db.prepare(`
          INSERT INTO reading_history (user_id, series_slug, chapter_number, percent, page, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, series_slug) DO UPDATE SET
            chapter_number = excluded.chapter_number,
            percent = excluded.percent,
            page = excluded.page,
            updated_at = excluded.updated_at
        `).run(user.id, slug, chapterNumber, percent, page, now)
        await syncDocToFirebase('reading_history', `${user.id}_${slug}`, {
          user_id: user.id,
          series_slug: slug,
          chapter_number: chapterNumber,
          percent,
          page,
          updated_at: now,
        })
      }
    } else if (action === 'unlock_chapter') {
      const slug = String(body.seriesSlug || '').trim()
      const chapterNumber = Number(body.chapterNumber || 1)
      const chapterId = String(body.chapterId || `${slug}-ep-${chapterNumber}`)
      const useFreePass = Boolean(body.useFreePass)
      const coinPrice = Math.max(0, Number(body.coinPrice || 5))

      const already = db
        .prepare('SELECT 1 FROM unlocked_chapters WHERE user_id = ? AND chapter_id = ?')
        .get(user.id, chapterId)
      if (!already && user.plan !== 'plus') {
        db.exec('BEGIN IMMEDIATE')
        let unlockTxId: string | null = null
        let unlockTxRef: string | null = null
        try {
          const fresh = findUserById(user.id)!
          if (useFreePass) {
            if (fresh.free_pass_tickets <= 0) throw new Error('ตั๋วอ่านฟรีไม่เพียงพอ')
            db.prepare('UPDATE users SET free_pass_tickets = free_pass_tickets - 1, updated_at = ? WHERE id = ?').run(
              now,
              user.id,
            )
          } else if (coinPrice > 0) {
            if (fresh.coin_balance < coinPrice) throw new Error('เหรียญไม่เพียงพอ กรุณาเติมเหรียญก่อน')
            db.prepare('UPDATE users SET coin_balance = coin_balance - ?, updated_at = ? WHERE id = ?').run(
              coinPrice,
              now,
              user.id,
            )
            unlockTxId = `tx-${crypto.randomUUID()}`
            unlockTxRef = `UNL-${Date.now()}`
            db.prepare(`
              INSERT INTO wallet_transactions (id, reference, user_id, provider, type, coins, amount_thb, status, verification_note, created_at)
              VALUES (?, ?, ?, 'system', 'purchase', ?, 0, 'completed', ?, ?)
            `).run(unlockTxId, unlockTxRef, user.id, -coinPrice, `ปลดล็อก ${slug} ตอนที่ ${chapterNumber}`, now)
          }
          db.prepare(`
            INSERT OR IGNORE INTO unlocked_chapters (user_id, chapter_id, series_slug, chapter_number, coins_paid, unlocked_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(user.id, chapterId, slug, chapterNumber, useFreePass ? 0 : coinPrice, now)
          db.prepare(`
            INSERT INTO series_stats (series_slug, unlocks_count) VALUES (?, 1)
            ON CONFLICT(series_slug) DO UPDATE SET unlocks_count = unlocks_count + 1
          `).run(slug)
          db.exec('COMMIT')
        } catch (e) {
          db.exec('ROLLBACK')
          throw e
        }

        await syncDocToFirebase('unlocked_chapters', `${user.id}_${chapterId}`, {
          user_id: user.id,
          chapter_id: chapterId,
          series_slug: slug,
          chapter_number: chapterNumber,
          coins_paid: useFreePass ? 0 : coinPrice,
          unlocked_at: now,
        })
        if (unlockTxId && unlockTxRef) {
          await syncDocToFirebase('wallet_transactions', unlockTxId, {
            id: unlockTxId,
            reference: unlockTxRef,
            user_id: user.id,
            provider: 'system',
            recipient_id: '1709700341765',
            type: 'purchase',
            coins: -coinPrice,
            amount_thb: 0,
            status: 'completed',
            verification_note: `ปลดล็อก ${slug} ตอนที่ ${chapterNumber}`,
            created_at: now,
          })
        }
        const statRow = db.prepare('SELECT * FROM series_stats WHERE series_slug = ?').get(slug) as
          | Record<string, unknown>
          | undefined
        if (statRow) {
          await syncDocToFirebase('series_stats', slug, { ...statRow, updatedAt: now })
        }
      }
    } else if (action === 'upgrade_plus') {
      return NextResponse.json(
        {
          ok: false,
          error: 'ไม่สามารถสมัครแพ็กเกจฟรีได้ กรุณาชำระเงินผ่าน PromptPay หรือ TrueMoney พร้อมอัปโหลดสลิปจริง',
        },
        { status: 402 },
      )
    }

    const updatedUser = findUserById(user.id)!
    await syncDocToFirebase('users', updatedUser.id, {
      coinBalance: updatedUser.coin_balance,
      freePassTickets: updatedUser.free_pass_tickets,
      plan: updatedUser.plan,
      updatedAt: updatedUser.updated_at,
    })
    return NextResponse.json({
      ok: true,
      persistedToDb: true,
      ...extraPayload,
      user: sanitizePublicUser(updatedUser),
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Action failed' }, { status: 400 })
  }
}
