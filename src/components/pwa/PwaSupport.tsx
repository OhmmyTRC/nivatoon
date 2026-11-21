'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPromptGlobal: BeforeInstallPromptEvent | null = null

export function applyDocumentTheme(mode: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', mode === 'dark')
  root.dataset.theme = mode
  try {
    window.localStorage.setItem('nivatoon_theme_mode', mode)
  } catch {}
}

export function PwaSupport() {
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem('nivatoon_theme_mode')
      if (savedTheme === 'dark' || savedTheme === 'light') {
        applyDocumentTheme(savedTheme)
      }
    } catch {}

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const handler = (e: Event) => {
      e.preventDefault()
      deferredPromptGlobal = e as BeforeInstallPromptEvent
      window.dispatchEvent(new Event('nivatoon:pwa-ready'))
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  return null
}

export function usePwaInstall() {
  const [canPrompt, setCanPrompt] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setCanPrompt(Boolean(deferredPromptGlobal))
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
    }
    const onReady = () => setCanPrompt(true)
    const onInstalled = () => {
      setInstalled(true)
      deferredPromptGlobal = null
      setCanPrompt(false)
    }
    window.addEventListener('nivatoon:pwa-ready', onReady)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('nivatoon:pwa-ready', onReady)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const triggerInstall = async (): Promise<'installed' | 'dismissed' | 'manual'> => {
    if (!deferredPromptGlobal) return 'manual'
    await deferredPromptGlobal.prompt()
    const choice = await deferredPromptGlobal.userChoice
    if (choice.outcome === 'accepted') {
      deferredPromptGlobal = null
      setCanPrompt(false)
      return 'installed'
    }
    return 'dismissed'
  }

  return { canPrompt, installed, triggerInstall }
}
