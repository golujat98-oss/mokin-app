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
  Edit2,
  Phone,
  Share2,
  Eye
} from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  total_amount: number
  advance_amount: number
}

const formatIndianDate = (dateStr: string) => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const year = parseInt(parts[0], 10)
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${months[monthIdx]} ${year}`
}

const format12HourTime = (timeStr: string | null | undefined) => {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let hour = parseInt(parts[0], 10)
  const minute = parts[1]
  const period = hour >= 12 ? 'PM' : 'AM'
  if (hour > 12) hour -= 12
  if (hour === 0) hour = 12
  return `${hour}:${minute} ${period}`
}

const getServiceIcon = (category: string | null | undefined) => {
  const cat = (category || '').toLowerCase()
  if (cat.includes('birthday') || cat.includes('cake')) return '🎂'
  if (cat.includes('barat') || cat.includes('music') || cat.includes('dj')) return '🎵'
  if (cat.includes('tent') || cat.includes('decor')) return '🎪'
  if (cat.includes('reception') || cat.includes('wedding') || cat.includes('marriage')) return '💍'
  if (cat.includes('conference') || cat.includes('meeting')) return '💼'
  if (cat.includes('concert') || cat.includes('show')) return '🎸'
  return '🎉'
}

export default function CalendarPage() {
  const supabase = createClient()
  const router = useRouter()

  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

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
        .select('id, customer_name, mobile_number, event_date, start_time, end_time, venue_address, program_name_snapshot, status, remaining_amount, total_amount, advance_amount')
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
    setMounted(true)
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

  const todayStr = useMemo(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
        Loading schedule...
      </div>
    )
  }

  return (
    <>
      <title>Calendar | Smart Booking Pro</title>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="text-purple-500 shadow-sm" />
            Smart Scheduler
          </h1>
          <p className="text-slate-400 text-sm mt-1">Monthly calendar view with automatic booking overlap detection and schedule markers.</p>
        </div>
        <div>
          <Link href="/bookings?new=true">
            <span className="flex items-center bg-purple-650 hover:bg-purple-700 text-white font-semibold text-sm px-4.5 py-2.5 rounded-xl transition-all shadow-lg shadow-purple-650/15 active:scale-95 cursor-pointer hover:shadow-purple-650/25">
              <Plus size={16} className="mr-2" /> New Booking
            </span>
          </Link>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="w-full">
        
        {/* CALENDAR COLUMN (FULL-WIDTH) */}
        <div className="w-full bg-slate-900/40 backdrop-blur-xl border border-slate-850 p-6 rounded-[24px] flex flex-col shadow-2xl shadow-indigo-950/20 ring-1 ring-white/5 relative overflow-hidden">
          {/* Soft purple glow accents */}
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />

          {/* Calendar Header Navigation */}
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                {months[month]} <span className="text-purple-400 font-semibold">{year}</span>
              </h2>
              <p className="text-slate-500 text-[11px] font-medium mt-0.5">Manage and view monthly events</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2.5 rounded-full border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all duration-150 cursor-pointer bg-slate-950/40 hover:bg-slate-900 active:scale-90"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2.5 rounded-full border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all duration-150 cursor-pointer bg-slate-950/40 hover:bg-slate-900 active:scale-90"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* DAYS OF WEEK GRID */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-550 uppercase tracking-wider relative z-10">
            {daysOfWeek.map((day) => (
              <div key={day} className="py-2">{day}</div>
            ))}
          </div>

          {/* CALENDAR CELLS GRID */}
          <div className="grid grid-cols-7 gap-2 flex-1 min-h-[350px] relative z-10">
            {gridCells.map((cell, idx) => {
              const dayBookings = bookingsByDate[cell.dateStr] || []
              const hasBookings = dayBookings.length > 0
              const hasOverlaps = overlapsByDate[cell.dateStr] || false
              const isSelected = selectedDayStr === cell.dateStr
              const isToday = cell.dateStr === todayStr

              let cellStyle = `relative rounded-xl p-2 flex flex-col justify-between min-h-[56px] aspect-[4/3] sm:aspect-auto sm:min-h-[110px] md:min-h-[120px] select-none transition-all duration-200 ease-out border text-left `

              if (!cell.isCurrentMonth) {
                cellStyle += `bg-slate-950/5 border-transparent text-slate-700 opacity-20 cursor-default hover:bg-transparent pointer-events-none`
              } else if (isSelected) {
                cellStyle += `bg-indigo-600 border-transparent text-white shadow-lg shadow-indigo-500/25 hover:scale-[1.04] active:scale-95 cursor-pointer`
              } else {
                cellStyle += `bg-slate-950/30 border-slate-900/60 text-slate-350 hover:border-slate-800 hover:bg-slate-900/10 hover:scale-[1.04] active:scale-95 cursor-pointer `
                
                if (isToday) {
                  cellStyle += `ring-2 ring-indigo-500/80 shadow-[0_0_15px_-3px_rgba(99,102,241,0.5)] border-transparent bg-indigo-500/5 `
                } else if (hasOverlaps) {
                  cellStyle += `bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40 `
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => cell.isCurrentMonth && handleSelectDay(cell.dateStr, dayBookings)}
                  disabled={!cell.isCurrentMonth}
                  className={cellStyle}
                >
                  <div className="flex justify-between items-center w-full mb-1 shrink-0">
                    <span className={`text-xs font-extrabold flex items-center justify-center rounded-full shrink-0 ${
                      !cell.isCurrentMonth ? '' :
                      isSelected ? 'text-white w-5 h-5' :
                      isToday ? 'bg-indigo-500 text-white w-5 h-5 shadow-sm shadow-indigo-500/25' :
                      hasOverlaps ? 'text-amber-500 w-5 h-5' :
                      'text-slate-400 w-5 h-5'
                    }`}>
                      {cell.day}
                    </span>
                    {cell.isCurrentMonth && dayBookings.length > 1 && (
                      <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full leading-none shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {dayBookings.length}
                      </span>
                    )}
                  </div>

                  {cell.isCurrentMonth && hasBookings && (
                    <div className="w-full flex-1 flex flex-col gap-1 justify-end overflow-hidden">
                      {/* Desktop stack view */}
                      <div className="hidden sm:flex flex-col gap-1.5 w-full">
                        {dayBookings.slice(0, 2).map((b) => {
                          const emoji = getServiceIcon(b.program_name_snapshot)
                          const name = b.program_name_snapshot || b.customer_name || 'Event'
                          let badgeColor = 'bg-slate-500/15 text-slate-200 border border-slate-500/30'
                          const statusLower = (b.status || '').toLowerCase()
                          if (statusLower === 'confirmed') badgeColor = 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_6px_rgba(16,185,129,0.05)]'
                          else if (statusLower === 'pending') badgeColor = 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_6px_rgba(245,158,11,0.05)]'
                          else if (statusLower === 'completed') badgeColor = 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-[0_0_6px_rgba(99,102,241,0.05)]'
                          else if (statusLower === 'cancelled') badgeColor = 'bg-rose-500/15 text-rose-300 border border-rose-500/30'

                          return (
                            <div
                              key={b.id}
                              role="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/bookings?view=${b.id}`)
                              }}
                              className={`w-full px-2 py-1 rounded-lg text-[10.5px] sm:text-xs font-bold truncate flex items-center gap-1.5 min-h-[22px] sm:min-h-[24px] active:scale-95 transition-all cursor-pointer ${
                                isSelected ? 'bg-white/20 text-white border-transparent' : badgeColor
                              }`}
                              title={`Client: ${b.customer_name}\nProgram: ${b.program_name_snapshot || 'General Event'}\nStatus: ${b.status}`}
                            >
                              <span className="shrink-0">{emoji}</span>
                              <span className="truncate">{name}</span>
                            </div>
                          )
                        })}
                        {dayBookings.length > 2 && (
                          <span className={`text-[8px] font-black tracking-wider uppercase pl-1 ${isSelected ? 'text-white/60' : 'text-indigo-400'}`}>
                            +{dayBookings.length - 2} more
                          </span>
                        )}
                      </div>

                      {/* Mobile view tags/chips */}
                      <div className="flex sm:hidden flex-col gap-0.5 w-full overflow-hidden mt-0.5">
                        {dayBookings.slice(0, 2).map((b) => {
                          const emoji = getServiceIcon(b.program_name_snapshot)
                          const name = b.program_name_snapshot || b.customer_name || 'Event'
                          let badgeColor = 'bg-slate-500/15 text-slate-200 border border-slate-500/30'
                          const statusLower = (b.status || '').toLowerCase()
                          if (statusLower === 'confirmed') badgeColor = 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          else if (statusLower === 'pending') badgeColor = 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          else if (statusLower === 'completed') badgeColor = 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                          else if (statusLower === 'cancelled') badgeColor = 'bg-rose-500/15 text-rose-300 border border-rose-500/30'

                          return (
                            <div
                              key={b.id}
                              role="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/bookings?view=${b.id}`)
                              }}
                              className={`w-full px-1 py-0.5 rounded text-[8px] font-extrabold truncate flex items-center gap-1 min-h-[16px] active:scale-95 transition-all cursor-pointer ${
                                isSelected ? 'bg-white/20 text-white border-transparent' : badgeColor
                              }`}
                              title={`Client: ${b.customer_name}\nProgram: ${b.program_name_snapshot || 'General Event'}\nStatus: ${b.status}`}
                            >
                              <span className="shrink-0">{emoji}</span>
                              <span className="truncate">{name}</span>
                            </div>
                          )
                        })}
                        {dayBookings.length > 2 ? (
                          <div className="flex items-center justify-between w-full px-0.5 mt-0.5 shrink-0">
                            <span className={`text-[7px] font-black uppercase ${isSelected ? 'text-white/60' : 'text-indigo-400'}`}>
                              +{dayBookings.length - 2} more
                            </span>
                            <div className="flex gap-0.5 shrink-0">
                              {dayBookings.slice(2, 5).map((b) => {
                                let dotColor = 'bg-slate-500'
                                const statusLower = (b.status || '').toLowerCase()
                                if (statusLower === 'confirmed') dotColor = 'bg-emerald-500'
                                else if (statusLower === 'pending') dotColor = 'bg-amber-500'
                                else if (statusLower === 'completed') dotColor = 'bg-indigo-500'
                                else if (statusLower === 'cancelled') dotColor = 'bg-rose-500'
                                return (
                                  <span key={b.id} className={`w-1 h-1 rounded-full shrink-0 ${isSelected ? 'bg-white' : dotColor}`} />
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-0.5 px-0.5 mt-0.5 shrink-0">
                            {dayBookings.map((b) => {
                              let dotColor = 'bg-slate-500'
                              const statusLower = (b.status || '').toLowerCase()
                              if (statusLower === 'confirmed') dotColor = 'bg-emerald-500'
                              else if (statusLower === 'pending') dotColor = 'bg-amber-500'
                              else if (statusLower === 'completed') dotColor = 'bg-indigo-500'
                              else if (statusLower === 'cancelled') dotColor = 'bg-rose-500'
                              return (
                                <span key={b.id} className={`w-1 h-1 rounded-full shrink-0 ${isSelected ? 'bg-white' : dotColor}`} />
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* SELECTED DAY DETAILS OVERLAY POPUP MODAL */}
      <AnimatePresence>
        {selectedDayStr && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-auto relative z-50 ring-1 ring-white/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/40">
                <div>
                  <h3 className="font-extrabold text-xl text-white tracking-tight">Event Schedule Details</h3>
                  <p className="text-xs text-purple-400 font-semibold mt-1">
                    📅 {formatIndianDate(selectedDayStr)} • {selectedBookings.length} active slot{selectedBookings.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDayStr(null)}
                  className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto font-sans">
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
                  selectedBookings.map((b) => {
                    const cleanedMobile = b.mobile_number.replace(/\D/g, '')
                    const phoneLink = `tel:${cleanedMobile}`
                    const whatsappLink = `https://wa.me/${cleanedMobile.length === 10 ? '91' + cleanedMobile : cleanedMobile}`
                    const mapsLink = b.venue_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.venue_address)}` : null
                    const initials = b.customer_name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || '👤'

                    const isPaid = Number(b.remaining_amount) === 0

                    return (
                      <div key={b.id} className="bg-slate-950/40 border border-slate-800 rounded-2xl overflow-hidden shadow-lg p-5 space-y-6 relative">
                        {/* Top Hero Section */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-900">
                          <div>
                            <h4 className="text-lg font-bold text-white tracking-tight">{b.program_name_snapshot || 'General Event'}</h4>
                            <p className="text-xs text-slate-400 mt-0.5">{formatIndianDate(b.event_date)}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto tracking-wide uppercase ${
                            b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                            b.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                            b.status === 'completed' ? 'bg-indigo-500/10 text-indigo-455 border border-indigo-500/20' :
                            'bg-rose-500/10 text-rose-455 border border-rose-500/20'
                          }`}>
                            {b.status}
                          </span>
                        </div>

                        {/* Customer & Actions Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Customer Info Box */}
                          <div className="space-y-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Customer Details</span>
                            <div className="flex items-center gap-3.5 bg-slate-950/35 p-3 rounded-xl border border-slate-900/60">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xs shadow-md">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <h5 className="text-sm font-bold text-white truncate">{b.customer_name}</h5>
                                <p className="text-xs text-slate-400 truncate">{b.mobile_number}</p>
                              </div>
                            </div>
                            {/* Call and WhatsApp buttons */}
                            <div className="flex gap-2.5">
                              <a
                                href={phoneLink}
                                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors text-xs font-semibold active:scale-95"
                              >
                                <Phone size={12} className="text-indigo-400" /> Call Client
                              </a>
                              <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors text-xs font-semibold active:scale-95"
                              >
                                <Share2 size={12} className="text-emerald-400" /> WhatsApp
                              </a>
                            </div>
                          </div>

                          {/* Event details */}
                          <div className="space-y-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Event Schedule</span>
                            <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-900/60 text-xs space-y-2 text-slate-300">
                              <div className="flex items-center gap-2">
                                <Clock size={12} className="text-slate-500 animate-pulse" />
                                <span>
                                  {b.start_time && b.end_time
                                    ? `${format12HourTime(b.start_time)} - ${format12HourTime(b.end_time)}`
                                    : 'Time unspecified'}
                                </span>
                              </div>
                              {b.venue_address ? (
                                <div className="flex items-start gap-2">
                                  <MapPin size={12} className="text-slate-500 mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="truncate max-w-[220px]" title={b.venue_address}>{b.venue_address}</p>
                                    {mapsLink && (
                                      <a
                                        href={mapsLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-355 inline-flex items-center mt-1"
                                      >
                                        Navigate <ExternalLink size={10} className="ml-0.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-slate-500">No venue address provided</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Payment Status Box */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Breakdown</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${isPaid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-amber-500/10 text-amber-500 border-amber-500/25'}`}>
                              {isPaid ? 'PAID' : 'DUE'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-950/20 border border-slate-900/60 p-3 rounded-xl text-center shadow-sm">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Total</p>
                              <p className="text-sm font-bold text-white mt-1">₹{Number(b.total_amount).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-slate-950/20 border border-slate-900/60 p-3 rounded-xl text-center shadow-sm">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Advance</p>
                              <p className="text-sm font-bold text-white mt-1">₹{Number(b.advance_amount).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-slate-950/20 border border-slate-900/60 p-3 rounded-xl text-center shadow-sm">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Balance</p>
                              <p className={`text-sm font-black mt-1 ${isPaid ? 'text-emerald-400' : 'text-amber-500'}`}>
                                ₹{Number(b.remaining_amount).toLocaleString('en-IN')}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Actions Section */}
                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-900">
                          <Link href={`/bookings?view=${b.id}`}>
                            <span className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95">
                              <Eye size={12} className="text-indigo-400" /> View Details
                            </span>
                          </Link>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
