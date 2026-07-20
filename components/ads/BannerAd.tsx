'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AD_CONFIG, AdPlacementConfig } from '@/lib/adConfig'

interface BannerAdProps {
  placement: 'top' | 'middle' | 'bottom'
}

export default function BannerAd({ placement }: BannerAdProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const adRef = useRef<HTMLDivElement>(null)
  
  const configKey = placement === 'top' ? 'dashboard_top' : placement
  const config = AD_CONFIG[configKey] as AdPlacementConfig
  
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isFailed, setIsFailed] = useState(false)

  // 1. SSR safety check (hydrates on client only)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 2. IntersectionObserver for Lazy Loading
  useEffect(() => {
    if (!isMounted || !config || !config.visible || isVisible) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '150px', // Load ads slightly before they enter the viewport
        threshold: 0.01,
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [isMounted, isVisible, config])

  // 3. Ad Script Loading Logic
  useEffect(() => {
    if (!isVisible || !config || !config.visible || isFailed) return
    if (!adRef.current || adRef.current.children.length > 0) return

    let isDisposed = false

    const loadAd = async () => {
      try {
        if (config.provider === 'adsterra') {
          const atOptions = {
            key: config.zoneId,
            format: 'iframe',
            height: config.height,
            width: config.width,
            params: {}
          }

          ;(window as any).atOptions = atOptions

          const configScript = document.createElement('script')
          configScript.id = `adsterra-conf-${config.zoneId}`
          configScript.innerHTML = `atOptions = ${JSON.stringify(atOptions)}`

          const invokeScript = document.createElement('script')
          invokeScript.id = `adsterra-invoke-${config.zoneId}`
          invokeScript.type = 'text/javascript'
          invokeScript.src = `//www.highperformanceformat.com/${config.zoneId}/invoke.js`
          invokeScript.async = true

          invokeScript.onload = () => {
            if (!isDisposed) {
              setIsLoaded(true)
            }
          }
          invokeScript.onerror = () => {
            if (!isDisposed) {
              setIsFailed(true)
            }
          }

          if (adRef.current) {
            adRef.current.appendChild(configScript)
            adRef.current.appendChild(invokeScript)
          }

          // Fallback safety timeout if onload/onerror events don't trigger (e.g. adblocker)
          setTimeout(() => {
            if (!isDisposed && !isLoaded && !isFailed) {
              // Check if any iframe got written or if it remained empty
              if (adRef.current && adRef.current.innerHTML.trim() === '') {
                setIsFailed(true)
              } else {
                setIsLoaded(true)
              }
            }
          }, 4000)

        } else if (config.provider === 'adsense') {
          // Future Google AdSense layout logic integration point
          setIsLoaded(true)
        }
      } catch (err) {
        console.error(`Error loading ${placement} banner:`, err)
        if (!isDisposed) {
          setIsFailed(true)
        }
      }
    }

    loadAd()

    return () => {
      isDisposed = true
      if (adRef.current) {
        adRef.current.innerHTML = ''
      }
    }
  }, [isVisible, config, isFailed, placement])

  // SSR Safety / config disabled
  if (!isMounted || !config || !config.visible) return null

  // If ad loading failed, fully collapse the component to prevent blank whitespace
  if (isFailed) return null

  const showSkeleton = !isLoaded && isVisible

  const wrapperStyle: React.CSSProperties = {
    minHeight: `${config.height + 24}px`,
  }

  const adStyle: React.CSSProperties = {
    width: `${config.width}px`,
    height: `${config.height}px`,
  }

  return (
    <div 
      ref={containerRef}
      style={wrapperStyle}
      className="w-full flex justify-center my-4 overflow-hidden bg-slate-900/10 rounded-xl border border-white/[0.03] p-3 z-10 relative transition-all duration-300"
    >
      {/* Premium Loading Skeleton */}
      {showSkeleton && (
        <div 
          style={adStyle}
          className="bg-slate-900/60 rounded-lg animate-pulse flex flex-col items-center justify-center border border-white/[0.05] absolute"
        >
          <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 animate-pulse">
            Loading Ad...
          </div>
        </div>
      )}

      {/* Ad content wrapper */}
      <div 
        ref={adRef} 
        style={adStyle}
        className={`flex justify-center items-center ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      />
    </div>
  )
}
