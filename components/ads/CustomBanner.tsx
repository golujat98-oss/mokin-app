'use client'

import React from 'react'
import { AD_CONFIG } from '@/lib/adConfig'

export default function CustomBanner() {
  const config = AD_CONFIG.bottomCustom

  if (!config || !config.visible) return null

  return (
    <div className="w-full flex justify-center my-4 z-10 relative">
      <a
        href={config.link}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full max-w-[320px] h-[50px] rounded-xl flex items-center justify-between px-3 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white shadow-[0_4px_15px_rgba(220,39,67,0.35)] hover:shadow-[0_6px_20px_rgba(220,39,67,0.5)] active:scale-[0.98] transition-all duration-300 overflow-hidden relative group cursor-pointer"
      >
        {/* Profile Image & Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0 relative bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={config.image} 
              alt={config.title} 
              className="w-full h-full object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
              }}
            />
          </div>
          <div className="flex flex-col justify-center min-w-0 text-left">
            <div className="flex items-center gap-1">
              <span className="text-xs font-black tracking-tight truncate leading-none">
                {config.title}
              </span>
              {/* Verified badge */}
              <svg className="w-3.5 h-3.5 fill-sky-400 shrink-0" viewBox="0 0 24 24">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <span className="text-[9px] font-medium text-white/80 leading-none truncate mt-0.5">
              {config.subtitle}
            </span>
          </div>
        </div>

        {/* Animated Follow Button */}
        <button 
          className="bg-white text-rose-600 font-extrabold text-[9px] px-3.5 py-1.5 rounded-lg uppercase tracking-wider transition-all duration-300 group-hover:scale-105 active:scale-95 shadow-sm shrink-0 cursor-pointer hover:bg-rose-50"
          tabIndex={-1}
        >
          {config.button}
        </button>
      </a>
    </div>
  )
}
