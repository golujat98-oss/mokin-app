'use client'

import { useEffect } from 'react'
import toast from 'react-hot-toast'

let beforeInstallPromptListenerRegistered = false
let hasHandledInstallPromptThisSession = false
let isPromptCurrentlyShowing = false

export default function PwaInstallPrompt() {
  useEffect(() => {
    const isStandalone =
      window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches

    const isIOSStandalone = (navigator as any).standalone === true

    if (isStandalone || isIOSStandalone) return
    if (hasHandledInstallPromptThisSession) return

    // Check localStorage dismissal
    const isDismissed = localStorage.getItem('pwa-prompt-dismissed') === 'true'
    if (isDismissed) return

    // 1. Register Service Worker (no-op if already registered by browser)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('Service Worker registered:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err))
    }

    // Prevent duplicate event listeners across multiple component mounts
    if (beforeInstallPromptListenerRegistered) return
    beforeInstallPromptListenerRegistered = true

    // 2. Handle Android browser install prompt
    let deferredPrompt: any = null

    const handleInstallPrompt = (e: Event) => {
      if (hasHandledInstallPromptThisSession) return
      if (isPromptCurrentlyShowing) return

      const isDismissedCheck = localStorage.getItem('pwa-prompt-dismissed') === 'true'
      if (isDismissedCheck) return

      // Some browsers can re-fire this prompt; ensure we only handle once per session.
      e.preventDefault()
      deferredPrompt = e
      isPromptCurrentlyShowing = true

      toast((t) => (
        <div className="flex flex-col gap-2 p-1 text-slate-200">
          <p className="text-sm font-semibold">Install Smart Booking Pro App?</p>
          <p className="text-xs text-slate-400">Access bookings instantly from your home screen with offline caching support.</p>
          <div className="flex gap-2 justify-end mt-1">
            <button
              onClick={() => {
                toast.dismiss(t.id)
                hasHandledInstallPromptThisSession = true
                isPromptCurrentlyShowing = false
                localStorage.setItem('pwa-prompt-dismissed', 'true')
              }}
              className="px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(t.id)
                hasHandledInstallPromptThisSession = true
                isPromptCurrentlyShowing = false
                localStorage.setItem('pwa-prompt-dismissed', 'true')
                if (deferredPrompt) {
                  deferredPrompt.prompt()
                  const { outcome } = await deferredPrompt.userChoice
                  console.log(`User response to install prompt: ${outcome}`)
                  deferredPrompt = null
                }
              }}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-md"
            >
              Install
            </button>
          </div>
        </div>
      ), {
        duration: 15005,
        position: 'bottom-center',
        style: {
          background: '#0f172a',
          border: '1px solid #1e293b',
          color: '#fff',
          borderRadius: '16px',
          padding: '12px',
          marginBottom: typeof window !== 'undefined' && window.innerWidth < 768 ? '80px' : '0px'
        }
      })
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt, { once: false })

    return () => {
      // Intentionally do NOT remove the listener here; we prevent duplicates via a module-level guard.
      // This avoids race conditions where multiple mounts/remounts can briefly register duplicates.
      void handleInstallPrompt
    }
  }, [])

  return null
}
