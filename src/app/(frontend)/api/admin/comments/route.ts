import { NextResponse } from 'next/server'
import { getDb } from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'
import { deleteDocFromFirebase } from '@/lib/firebase-db'

export async function DELETE(request: Request) {
  const { session, user } = await getServerSession()
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden: Admin only' }, { status: 403 })
  }

  const url = new URL(request.url)
  const commentId = url.searchParams.get('id') || ''
  if (!commentId) {
    return NextResponse.json({ ok: false, error: 'Missing comment id' }, { status: 400 })
  }

  getDb().prepare('DELETE FROM comments WHERE id = ?').run(commentId)
  await deleteDocFromFirebase('comments', commentId)
  return NextResponse.json({ ok: true, deletedId: commentId })
}
