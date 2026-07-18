'use client'

import { useEffect } from 'react'
import toast from 'react-hot-toast'

export default function PwaInstallPrompt() {
  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => console.log('Service Worker registered:', reg.scope))
          .catch((err) => console.error('Service Worker registration failed:', err))
      })
    }

    // 2. Handle Android browser install prompt
    let deferredPrompt: any = null
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault()
      deferredPrompt = e

      // Present a Toast asking to install PWA app
      toast((t) => (
        <div className="flex flex-col gap-2 p-1 text-slate-200">
          <p className="text-sm font-semibold">Install Smart Booking Pro App?</p>
          <p className="text-xs text-slate-400">Access bookings instantly from your home screen with offline caching support.</p>
          <div className="flex gap-2 justify-end mt-1">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(t.id)
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
        duration: 15000,
        position: 'bottom-center',
        style: {
          background: '#0f172a',
          border: '1px solid #1e293b',
          color: '#fff',
          borderRadius: '16px',
          padding: '12px'
        }
      })
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
    }
  }, [])

  return null
}
