'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { AdService } from '@/lib/adService'

export default function DashboardAdBanner() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    const isAndroidDevice = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    setIsAndroid(isAndroidDevice)

    if (isAndroidDevice) {
      // Android AdMob adaptive banner
      AdService.showBanner()

      return () => {
        // Clean up banner when unmounting Dashboard
        AdService.removeBanner()
      }
    } else {
      // Web Adsterra banner
      if (!containerRef.current || containerRef.current.children.length > 0) return

      try {
        const atOptions = {
          key: '426d84b6522644d6827b82837d66fa25',
          format: 'iframe',
          height: 90,
          width: 728,
          params: {}
        }

        const configScript = document.createElement('script')
        configScript.innerHTML = `atOptions = ${JSON.stringify(atOptions)}`

        const invokeScript = document.createElement('script')
        invokeScript.type = 'text/javascript'
        invokeScript.src = `//www.highperformanceformat.com/${atOptions.key}/invoke.js`
        invokeScript.async = true

        containerRef.current.appendChild(configScript)
        containerRef.current.appendChild(invokeScript)
      } catch (error) {
        console.error('Failed to load Adsterra banner:', error)
      }
    }
  }, [])

  if (isAndroid) {
    // AdMob is a native overlay, so we don't render DOM elements on Android.
    return null
  }

  // On Web: render the inline Adsterra banner below KPI cards
  return (
    <div className="w-full flex justify-center my-4 overflow-hidden min-h-[90px] bg-slate-900/10 rounded-xl border border-white/[0.03] p-2">
      <div ref={containerRef} className="flex justify-center items-center w-full max-w-[728px] h-[90px]" />
    </div>
  )
}
