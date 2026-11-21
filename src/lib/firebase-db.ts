import fs from 'node:fs'
import path from 'node:path'
import {
  cert,
  getApps as getAdminApps,
  initializeApp as initializeAdminApp,
  type ServiceAccount,
} from 'firebase-admin/app'
import {
  getFirestore as getAdminFirestoreSdk,
  type Firestore as AdminFirestore,
} from 'firebase-admin/firestore'

let cachedAdminDb: AdminFirestore | null = null
let cachedAdminAttempted = false

function readServiceAccountFromEnv(): ServiceAccount | null {
  const inlineOrPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()
  if (inlineOrPath) {
    try {
      const jsonText = inlineOrPath.startsWith('{')
        ? inlineOrPath
        : fs.readFileSync(path.resolve(inlineOrPath), 'utf8')
      const parsed = JSON.parse(jsonText) as ServiceAccount
      if (parsed.projectId || (parsed as Record<string, unknown>).project_id) {
        return parsed
      }
    } catch {
      return null
    }
  }

  const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (gacPath) {
    const resolvedGac = path.resolve(gacPath)
    if (fs.existsSync(resolvedGac)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(resolvedGac, 'utf8')) as ServiceAccount
        if (parsed.projectId || (parsed as Record<string, unknown>).project_id) {
          return parsed
        }
      } catch {
        return null
      }
    }
  }

  // Fallback: detect Firebase Admin SDK key file in project root if env path wasn't updated
  try {
    const rootFiles = fs.readdirSync(process.cwd())
    const sdkFile = rootFiles.find(
      (f) => f === 'serviceAccountKey.json' || /firebase-adminsdk.*\.json$/i.test(f),
    )
    if (sdkFile) {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), sdkFile), 'utf8'),
      ) as ServiceAccount
      if (parsed.projectId || (parsed as Record<string, unknown>).project_id) {
        return parsed
      }
    }
  } catch {
    // ignore fs read errors
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'niva-421c2'
  if (clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey,
    }
  }

  return null
}

export function isFirebaseWebConfigured(): boolean {
  const apiKey = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const appId = process.env.FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  return Boolean(apiKey && appId && projectId)
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(readServiceAccountFromEnv())
}

export function isFirebaseConfigured(): boolean {
  return isFirebaseWebConfigured()
}

export function getFirebaseStatus() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'niva-421c2'
  return {
    projectId,
    webConfigured: isFirebaseWebConfigured(),
    analyticsConfigured: Boolean(
      process.env.FIREBASE_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    ),
    adminConnected: isFirebaseAdminConfigured(),
  }
}

export function getAdminFirestore(): AdminFirestore | null {
  if (cachedAdminDb) return cachedAdminDb
  if (cachedAdminAttempted) return null
  cachedAdminAttempted = true

  const serviceAccount = readServiceAccountFromEnv()
  if (!serviceAccount) return null

  try {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      serviceAccount.projectId ||
      (serviceAccount as unknown as { project_id?: string }).project_id ||
      'niva-421c2'
    const databaseURL =
      process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL

    const app =
      getAdminApps().length > 0
        ? getAdminApps()[0]!
        : initializeAdminApp({
            credential: cert(serviceAccount),
            projectId,
            ...(databaseURL ? { databaseURL } : {}),
          })

    cachedAdminDb = getAdminFirestoreSdk(app)
    return cachedAdminDb
  } catch {
    return null
  }
}

/**
 * Mirrors server records to Cloud Firestore (`niva-421c2`) via Firebase Admin SDK
 * while keeping local SQLite non-blocking when running offline or before a Service Account key is added.
 */
export async function syncDocToFirebase(
  collectionName: string,
  docId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const firestore = getAdminFirestore()
  if (!firestore) return false

  try {
    await firestore
      .collection(collectionName)
      .doc(docId)
      .set(
        {
          ...payload,
          syncedAt: new Date().toISOString(),
        },
        { merge: true },
      )
    return true
  } catch {
    return false
  }
}

export async function deleteDocFromFirebase(
  collectionName: string,
  docId: string,
): Promise<boolean> {
  const firestore = getAdminFirestore()
  if (!firestore) return false

  try {
    await firestore.collection(collectionName).doc(docId).delete()
    return true
  } catch {
    return false
  }
}
