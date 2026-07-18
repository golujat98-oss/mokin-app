'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Plus,
  Loader2,
  X,
  MapPin,
  ExternalLink,
  ChevronRightSquare,
  Edit2
} from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface Booking {
  id: string
  customer_name: string
  mobile_number: string
  event_date: string
  start_time: string | null
  end_time: string | null
  venue_address: string | null
  program_name_snapshot: string | null
  status: string
  remaining_amount: number
}

export default function CalendarPage() {
  const supabase = createClient()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  // Selected day detail panel state
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null)
  const [selectedBookings, setSelectedBookings] = useState<Booking[]>([])

  const fetchBookings = useCallback(async () => {
    try {
      // Get first and last day of the current month view boundary to optimize query fetch
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const startOfView = new Date(year, month - 1, 1).toISOString().split('T')[0]
      const endOfView = new Date(year, month + 2, 0).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('bookings')
        .select('id, customer_name, mobile_number, event_date, start_time, end_time, venue_address, program_name_snapshot, status, remaining_amount')
        .gte('event_date', startOfView)
        .lte('event_date', endOfView)
        .neq('status', 'cancelled')

      if (error) throw error
      setBookings(data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load calendar events')
    } finally {
      setLoading(false)
    }
  }, [supabase, currentDate])

  useEffect(() => {
    fetchBookings()

    // Realtime listeners
    const channel = supabase
      .channel('db-sync-calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchBookings, supabase])

  // Calendar math functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    setSelectedDayStr(null)
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    setSelectedDayStr(null)
  }

  const handleSelectDay = (dayStr: string, dayBookings: Booking[]) => {
    setSelectedDayStr(dayStr)
    setSelectedBookings(dayBookings)
  }

  // Check if a day has overlapping bookings
  const checkDayOverlaps = (dayBookings: Booking[]) => {
    if (dayBookings.length <= 1) return false

    // Look for any overlap between items: StartA < EndB AND StartB < EndA
    for (let i = 0; i < dayBookings.length; i++) {
      const b1 = dayBookings[i]
      if (!b1.start_time || !b1.end_time) continue

      for (let j = i + 1; j < dayBookings.length; j++) {
        const b2 = dayBookings[j]
        if (!b2.start_time || !b2.end_time) continue

        if (b1.start_time < b2.end_time && b2.start_time < b1.end_time) {
          return true // Overlap found!
        }
      }
    }
    return false
  }

  // Precompute map of dateStr -> bookings for fast lookup
  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {}
    bookings.forEach((b) => {
      if (!map[b.event_date]) {
        map[b.event_date] = []
      }
      map[b.event_date].push(b)
    })
    return map
  }, [bookings])

  // Precompute map of dateStr -> hasOverlaps
  const overlapsByDate = useMemo(() => {
    const map: Record<string, boolean> = {}
    Object.entries(bookingsByDate).forEach(([dateStr, dayBookings]) => {
      map[dateStr] = checkDayOverlaps(dayBookings)
    })
    return map
  }, [bookingsByDate])

  // Calendar render constants
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  const daysInMonth = getDaysInMonth(currentDate)
  const firstDayIndex = getFirstDayOfMonth(currentDate)
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Generate grid cells
  const gridCells = []
  // Padding cells for previous month
  const prevMonthDate = new Date(year, month - 1, 1)
  const daysInPrevMonth = getDaysInMonth(prevMonthDate)
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    gridCells.push({ day, isCurrentMonth: false, dateStr: dStr })
  }
  // Current month cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    gridCells.push({ day, isCurrentMonth: true, dateStr: dStr })
  }
  // Padding cells for next month to complete the row grid (multiples of 7)
  const totalCells = Math.ceil(gridCells.length / 7) * 7
  const nextMonthPadding = totalCells - gridCells.length
  for (let day = 1; day <= nextMonthPadding; day++) {
    const dStr = `${year}-${String(month + 2).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    gridCells.push({ day, isCurrentMonth: false, dateStr: dStr })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
        Loading schedule...
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="text-indigo-500" />
            Smart Scheduler
          </h1>
          <p className="text-slate-400 text-sm mt-1">Monthly calendar view with automatic booking overlap detection and schedule markers.</p>
        </div>
        <div>
          <Link href="/bookings?new=true">
            <span className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/15 active:scale-95 cursor-pointer">
              <Plus size={16} className="mr-2" /> New Booking
            </span>
          </Link>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* CALENDAR COLUMN */}
        <div className="lg:col-span-3 bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 rounded-2xl flex flex-col shadow-xl">
          {/* Calendar Header Navigation */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white tracking-wide">
              {months[month]} <span className="text-indigo-400 font-normal">{year}</span>
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-450 hover:text-white transition-colors cursor-pointer bg-slate-950/20"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-450 hover:text-white transition-colors cursor-pointer bg-slate-950/20"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* DAYS OF WEEK GRID */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {daysOfWeek.map((day) => (
              <div key={day} className="py-2">{day}</div>
            ))}
          </div>

          {/* CALENDAR CELLS GRID */}
          <div className="grid grid-cols-7 gap-2 flex-1 min-h-[350px]">
            {gridCells.map((cell, idx) => {
              // Get day bookings from precomputed map
              const dayBookings = bookingsByDate[cell.dateStr] || []
              const hasBookings = dayBookings.length > 0
              const hasOverlaps = overlapsByDate[cell.dateStr] || false
              const isSelected = selectedDayStr === cell.dateStr

              return (
                <button
                  key={idx}
                  onClick={() => cell.isCurrentMonth && handleSelectDay(cell.dateStr, dayBookings)}
                  disabled={!cell.isCurrentMonth}
                  className={`relative rounded-xl p-2.5 flex flex-col items-start min-h-[70px] select-none transition-all duration-150 border text-left ${
                    !cell.isCurrentMonth
                      ? 'bg-slate-950/10 border-transparent text-slate-700 opacity-40'
                      : isSelected
                      ? 'bg-indigo-500/10 border-indigo-500 text-white shadow-lg shadow-indigo-500/5'
                      : hasOverlaps
                      ? 'bg-amber-500/5 border-amber-500/20 text-white hover:border-amber-500/40'
                      : 'bg-slate-950/30 border-slate-900 text-slate-300 hover:border-slate-850 hover:bg-slate-900/10'
                  } ${cell.isCurrentMonth ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                >
                  <span className={`text-xs font-bold ${
                    !cell.isCurrentMonth ? '' : isSelected ? 'text-indigo-400' : hasOverlaps ? 'text-amber-500' : 'text-slate-400'
                  }`}>
                    {cell.day}
                  </span>

                  {/* Booking count dot indicators */}
                  {cell.isCurrentMonth && hasBookings && (
                    <div className="mt-auto flex flex-col gap-1 w-full">
                      {/* overlap warning badge */}
                      {hasOverlaps ? (
                        <span className="flex items-center text-[9px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/15 w-full truncate">
                          <AlertTriangle size={8} className="mr-1 shrink-0" /> Overlap
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400 bg-slate-950/50 border border-slate-900 px-1.5 py-0.5 rounded w-full truncate">
                          {dayBookings.length} {dayBookings.length === 1 ? 'Booking' : 'Bookings'}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* SELECTED DAY DETAILS COL */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 rounded-2xl flex flex-col shadow-xl min-h-[300px]">
          {selectedDayStr ? (
            <>
              {/* Header Details */}
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    {new Date(selectedDayStr).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">{selectedBookings.length} Bookings active</p>
                </div>
                <button
                  onClick={() => setSelectedDayStr(null)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Overlap Alarm */}
              {checkDayOverlaps(selectedBookings) && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-400 mb-6">
                  <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                  <div className="text-[10px]">
                    <p className="font-bold">Schedule Overlap Alert</p>
                    <p className="mt-0.5 text-slate-350">Two or more events have overlapping times. Check details below to avoid conflict issues.</p>
                  </div>
                </div>
              )}

              {/* Detail List */}
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[350px] pr-1">
                {selectedBookings.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 flex flex-col items-center">
                    <Clock size={32} className="text-slate-700 stroke-[1.5] mb-2" />
                    <p className="text-xs">No events scheduled on this day.</p>
                    <Link href={`/bookings?new=true`}>
                      <span className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold mt-2 flex items-center cursor-pointer">
                        Book this slot <ChevronLeft size={10} className="rotate-180 ml-0.5" />
                      </span>
                    </Link>
                  </div>
                ) : (
                  selectedBookings.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl hover:border-slate-800 transition-all flex flex-col gap-2.5"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-sm font-bold text-white">{b.customer_name}</h4>
                          <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/15 rounded text-[9px] text-indigo-400 font-semibold inline-block mt-1">
                            {b.program_name_snapshot || 'General Service'}
                          </span>
                        </div>
                        <Link href={`/bookings?edit=${b.id}`}>
                          <span className="p-1.5 rounded bg-slate-900/60 border border-slate-800/80 text-slate-400 hover:text-white transition-colors cursor-pointer">
                            <Edit2 size={12} />
                          </span>
                        </Link>
                      </div>

                      {/* Time & Venue */}
                      <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-900 pt-2.5">
                        {b.start_time && b.end_time && (
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-500" />
                            <span>{b.start_time.substring(0, 5)} - {b.end_time.substring(0, 5)}</span>
                          </div>
                        )}
                        {b.venue_address && (
                          <div className="flex items-start gap-1.5">
                            <MapPin size={12} className="text-slate-500 shrink-0 mt-0.5" />
                            <span className="truncate max-w-[180px]">{b.venue_address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center py-20">
              <CalendarIcon className="stroke-[1.5] h-10 w-10 text-slate-700 mb-3 animate-pulse" />
              <h3 className="text-sm font-bold text-white">Select a Date</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-[180px] mx-auto">Click any highlighted date inside the grid to preview events list.</p>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
