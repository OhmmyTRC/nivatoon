'use client'

import { useEffect } from 'react'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getFirebaseClientApp } from '@/lib/firebase-client'

export function FirebaseAnalytics() {
  useEffect(() => {
    let active = true
    const app = getFirebaseClientApp()
    if (!app || !process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) return

    void isSupported()
      .then((supported) => {
        if (active && supported) {
          getAnalytics(app)
        }
      })
      .catch(() => {
        // Ignore Analytics initialization issues when blocked by browser extensions
      })

    return () => {
      active = false
    }
  }, [])

  return null
}
