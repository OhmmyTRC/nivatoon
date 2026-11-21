import { NextResponse } from 'next/server'
import { addSystemLog } from '@/lib/app-db'
import { getServerSession } from '@/lib/auth'
import {
  getFirebaseStatus,
  pullCloudStateFromFirebase,
  syncFullDatabaseToFirebase,
} from '@/lib/firebase-db'
import {
  generateAndSaveComicsManifest,
  getGitHubStorageStatus,
  syncPublicFilesToGitHub,
} from '@/lib/github-storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  const pullResult = await pullCloudStateFromFirebase()
  return NextResponse.json({
    ok: true,
    firebase: getFirebaseStatus(),
    github: getGitHubStorageStatus(),
    pullResult,
  })
}

export async function POST(request: Request) {
  const { user } = await getServerSession()
  try {
    const body = await request.json().catch(() => ({}))
    const pushToGitHub = body?.pushToGitHub !== false

    // 1. Rebuild public/comics/manifest.json with GitHub Raw URLs
    generateAndSaveComicsManifest()

    // 2. Pull any mobile-originated records from Firebase first, then push complete merged state to Firebase
    const pullResult = await pullCloudStateFromFirebase()
    const firebaseSync = await syncFullDatabaseToFirebase()

    // 3. Optionally commit & push public/comics/ and public/uploads/ to GitHub
    let githubSync: {
      ok: boolean
      method: string
      rawUrls: string[]
      detail?: string
    } = {
      ok: true,
      method: 'manifest-updated',
      rawUrls: [],
    }

    if (pushToGitHub) {
      githubSync = await syncPublicFilesToGitHub({
        repoRelativePaths: ['public/comics'],
        commitMessage: 'chore(storage): sync comics manifest and assets to GitHub storage',
        regenerateManifest: false,
      })
    }

    addSystemLog(
      'info',
      'cloud-sync',
      `ซิงก์คลังไฟล์ GitHub (${firebaseSync.githubRepo}) และฐานข้อมูล Firebase (${firebaseSync.projectId}) สำเร็จ (${firebaseSync.counts.series} เรื่อง, ${firebaseSync.counts.users} ผู้ใช้)`,
      user?.email || 'system@nivatoon.app',
    )

    return NextResponse.json({
      ok: true,
      firebaseSync,
      pullResult,
      githubSync,
      firebase: getFirebaseStatus(),
      github: getGitHubStorageStatus(),
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Cloud sync failed' },
      { status: 500 },
    )
  }
}
