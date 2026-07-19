import React from 'react'

export default function ContactLoading() {
  return (
    <div className="space-y-6 text-left animate-pulse max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="space-y-2 mb-8">
        <div className="h-8 bg-slate-800 rounded w-48" />
        <div className="h-4 bg-slate-800 rounded w-72" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card Skeleton */}
        <div className="lg:col-span-1 h-[320px] bg-slate-900/30 rounded-3xl border border-slate-900" />

        {/* Contact Cards Skeleton */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="h-[120px] bg-slate-900/30 rounded-3xl border border-slate-900" />
          <div className="h-[120px] bg-slate-900/30 rounded-3xl border border-slate-900" />
          <div className="h-[120px] bg-slate-900/30 rounded-3xl border border-slate-900" />
        </div>
      </div>
    </div>
  )
}
