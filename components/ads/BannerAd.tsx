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
    let cleanupFn: (() => void) | undefined

    const loadAd = () => {
      try {
        if (config.provider === 'adsterra') {
          // Create isolated iframe to avoid global scope contamination / race conditions
          const iframe = document.createElement('iframe')
          iframe.style.width = '100%'
          iframe.style.height = '100%'
          iframe.style.border = 'none'
          iframe.style.overflow = 'hidden'
          iframe.scrolling = 'no'
          iframe.setAttribute('frameborder', '0')
          
          iframe.onload = () => {
            if (!isDisposed) {
              setIsLoaded(true)
            }
          }

          if (adRef.current) {
            adRef.current.appendChild(iframe)
          }

          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
          if (iframeDoc) {
            iframeDoc.open()
            iframeDoc.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <style>
                    body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; overflow: hidden; }
                  </style>
                  <script type="text/javascript">
                    var atOptions = {
                      key: '${config.zoneId}',
                      format: 'iframe',
                      height: ${config.height},
                      width: ${config.width},
                      params: {}
                    };
                  </script>
                  <script type="text/javascript" src="//www.highperformanceformat.com/${config.zoneId}/invoke.js" onerror="window.parent.postMessage('ad-failed-${config.zoneId}', '*')"></script>
                </head>
                <body>
                </body>
              </html>
            `)
            iframeDoc.close()
          }

          // Listen for failed event from iframe onerror
          const handleMessage = (event: MessageEvent) => {
            if (event.data === `ad-failed-${config.zoneId}`) {
              if (!isDisposed) {
                setIsFailed(true)
              }
            }
          }
          window.addEventListener('message', handleMessage)

          // Fallback safety timeout if onload/onerror events don't trigger (e.g. adblocker)
          const fallbackTimeout = setTimeout(() => {
            if (!isDisposed && !isLoaded && !isFailed) {
              try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document
                if (doc && doc.body && doc.body.innerHTML.trim() === '') {
                  setIsFailed(true)
                } else {
                  setIsLoaded(true)
                }
              } catch (e) {
                setIsLoaded(true)
              }
            }
          }, 4000)

          cleanupFn = () => {
            window.removeEventListener('message', handleMessage)
            clearTimeout(fallbackTimeout)
          }

        } else if (config.provider === 'adsense') {
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
      if (cleanupFn) {
        cleanupFn()
      }
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
