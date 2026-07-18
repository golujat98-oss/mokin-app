'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar,
  IndianRupee,
  TrendingUp,
  AlertCircle,
  Plus,
  Loader2,
  ChevronRight,
  ChevronLeft,
  TrendingDown,
  Clock,
  X,
  Phone,
  Share2,
  Edit2,
  FileDown,
  Eye,
  MapPin,
  ExternalLink
} from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'
import Link from 'next/link'
import { downloadBookingPDF } from '@/components/bookings/BookingContract'

interface DashboardStats {
  totalBookings: number
  confirmedBookings: number
  totalDues: number
  monthlyExpenses: number
}

interface Booking {
  id: string
  customer_name: string
  mobile_number: string
  event_date: string
  status: string
  total_amount: number
  advance_amount: number
  remaining_amount: number
  program_name_snapshot?: string
  start_time?: string | null
  end_time?: string | null
  venue_address?: string | null
}

interface Expense {
  id: string
  amount: number
  expense_date: string
}

// Loading Skeletons for Instant Feedbacks
const MetricSkeleton = () => (
  <div className="bg-slate-900/40 backdrop-blur-md border border-slate-900/60 p-5 rounded-2xl flex items-center justify-between shadow-xl animate-pulse">
    <div className="space-y-3 flex-1">
      <div className="h-3 bg-slate-800 rounded w-1/2" />
      <div className="h-7 bg-slate-800 rounded w-1/3" />
      <div className="h-3 bg-slate-800 rounded w-2/3" />
    </div>
    <div className="w-12 h-12 rounded-xl bg-slate-800/40 shrink-0" />
  </div>
)

const CalendarSkeleton = () => (
  <div className="lg:col-span-2 bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 rounded-2xl flex flex-col shadow-xl animate-pulse min-h-[360px]">
    <div className="flex justify-between items-center mb-6">
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-slate-800 rounded w-1/4" />
        <div className="h-3 bg-slate-800 rounded w-1/3" />
      </div>
      <div className="h-9 bg-slate-800 rounded w-32" />
    </div>
    <div className="grid grid-cols-7 gap-2 mb-2">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
        <div key={d} className="h-3 bg-slate-800 rounded w-1/2 mx-auto" />
      ))}
    </div>
    <div className="grid grid-cols-7 gap-2 flex-1">
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="h-12 bg-slate-950/20 rounded-xl border border-slate-900/40" />
      ))}
    </div>
  </div>
)

const DuesSkeleton = () => (
  <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 rounded-2xl flex flex-col shadow-xl animate-pulse min-h-[360px]">
    <div className="space-y-2 mb-6">
      <div className="h-4 bg-slate-800 rounded w-1/3" />
      <div className="h-3 bg-slate-800 rounded w-1/2" />
    </div>
    <div className="space-y-4">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex justify-between items-center p-3.5 bg-slate-950/20 rounded-xl border border-slate-900">
          <div className="space-y-2 flex-1 mr-4">
            <div className="h-3.5 bg-slate-800 rounded w-2/3" />
            <div className="h-2.5 bg-slate-800 rounded w-1/3" />
          </div>
          <div className="h-4 bg-slate-850 rounded w-16" />
        </div>
      ))}
    </div>
  </div>
)

const TableSkeleton = () => (
  <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 rounded-2xl mt-8 shadow-xl animate-pulse">
    <div className="space-y-2 mb-6">
      <div className="h-4 bg-slate-800 rounded w-1/6" />
      <div className="h-3 bg-slate-800 rounded w-1/4" />
    </div>
    <div className="space-y-4">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center justify-between border-b border-slate-900/40 pb-4 last:border-0 last:pb-0">
          <div className="space-y-2 flex-1">
            <div className="h-3.5 bg-slate-800 rounded w-1/4" />
            <div className="h-2.5 bg-slate-800 rounded w-1/5" />
          </div>
          <div className="h-3 bg-slate-800 rounded w-20" />
        </div>
      ))}
    </div>
  </div>
)

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

const formatDateToISOString = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function DashboardPage() {
  const supabase = createClient()
  
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0,
    confirmedBookings: 0,
    totalDues: 0,
    monthlyExpenses: 0
  })
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [dueBookings, setDueBookings] = useState<Booking[]>([])
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [profile, setProfile] = useState<any>({ business_name: 'My Business' })
  const [loading, setLoading] = useState(true)

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedBookings, setSelectedBookings] = useState<Booking[]>([])
  const [showPopup, setShowPopup] = useState(false)

  // Mount state for SSR hydration safety
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const todayStr = useMemo(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])

  const greeting = useMemo(() => {
    const hr = new Date().getHours()
    if (hr < 12) return 'Good morning'
    if (hr < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const todayBookings = useMemo(() => {
    return allBookings.filter(b => b.event_date === todayStr && b.status !== 'cancelled')
  }, [allBookings, todayStr])

  const nextEvent = useMemo(() => {
    const active = allBookings.filter(b => b.status !== 'cancelled' && b.event_date >= todayStr)
    const sorted = [...active].sort((a, b) => a.event_date.localeCompare(b.event_date))
    return sorted[0] || null
  }, [allBookings, todayStr])

  const fetchDashboardData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      const startOfMonthStr = startOfMonth.toISOString().split('T')[0]

      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]

      // Fetch bookings, expenses, and profile in parallel with only required columns
      const [bookingsRes, expensesRes, profileRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, customer_name, mobile_number, event_date, status, total_amount, advance_amount, remaining_amount, program_name_snapshot, start_time, end_time, venue_address')
          .order('event_date', { ascending: true }),
        supabase
          .from('expenses')
          .select('id, amount, expense_date')
          .gte('expense_date', sixMonthsAgoStr),
        supabase
          .from('profiles')
          .select('business_name, business_address, gst_number')
          .eq('id', user.id)
          .maybeSingle()
      ])

      if (bookingsRes.error) throw bookingsRes.error
      if (expensesRes.error) throw expensesRes.error

      const bookings = bookingsRes.data || []
      const expenses = expensesRes.data || []

      if (profileRes?.data) {
        setProfile(profileRes.data)
      } else {
        setProfile({ business_name: 'My Business' })
      }

      setAllBookings(bookings)

      // Calculate statistics
      let totalBookings = 0
      let confirmedBookings = 0
      let totalDues = 0
      const activeBookingsList: Booking[] = []
      const duesList: Booking[] = []

      totalBookings = bookings.length
      bookings.forEach((booking: Booking) => {
        if (booking.status === 'confirmed') {
          confirmedBookings++
        }
        if (booking.status !== 'cancelled' && booking.status !== 'completed') {
          totalDues += Number(booking.remaining_amount)
          if (Number(booking.remaining_amount) > 0) {
            duesList.push(booking)
          }
        }
        activeBookingsList.push(booking)
      });

      let monthlyExpenses = 0
      expenses.forEach((expense: Expense) => {
        if (expense.expense_date >= startOfMonthStr) {
          monthlyExpenses += Number(expense.amount)
        }
      })

      setStats({
        totalBookings,
        confirmedBookings,
        totalDues,
        monthlyExpenses
      })

      // Recent Bookings (limit to 5)
      setRecentBookings(activeBookingsList.slice(0, 5))
      // Dues Bookings (limit to 5)
      setDueBookings(duesList.slice(0, 5))

    } catch (err) {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Setup Real-time Postgres changes listeners
  useEffect(() => {
    fetchDashboardData()

    const channel = supabase
      .channel('db-sync-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchDashboardData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        fetchDashboardData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchDashboardData, supabase])

  // Calendar Grid construction
  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    const firstDay = new Date(year, month, 1)
    const startDay = firstDay.getDay() // 0 is Sunday, 1 is Monday, etc.
    const totalDays = new Date(year, month + 1, 0).getDate()

    const cells = []

    // Padding days from previous month
    const prevMonthDays = new Date(year, month, 0).getDate()
    for (let i = startDay - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i
      cells.push({
        date: new Date(year, month - 1, dayNum),
        isCurrentMonth: false,
        dayNumber: dayNum
      })
    }

    // Days in current month
    for (let d = 1; d <= totalDays; d++) {
      cells.push({
        date: new Date(year, month, d),
        isCurrentMonth: true,
        dayNumber: d
      })
    }

    // Padding days from next month to make a complete week grid
    const totalGridSize = Math.ceil(cells.length / 7) * 7
    const nextDaysNeeded = totalGridSize - cells.length
    for (let d = 1; d <= nextDaysNeeded; d++) {
      cells.push({
        date: new Date(year, month + 1, d),
        isCurrentMonth: false,
        dayNumber: d
      })
    }

    return cells
  }, [currentMonth])

  // Group bookings by date for calendar lookup
  const bookingsByDate = useMemo(() => {
    const groups: { [key: string]: Booking[] } = {}
    allBookings.forEach((b) => {
      if (b.event_date) {
        if (!groups[b.event_date]) {
          groups[b.event_date] = []
        }
        groups[b.event_date].push(b)
      }
    })
    return groups
  }, [allBookings])

  if (loading) {
    return (
      <>
        {/* Upper header action bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard</h1>
            <p className="text-slate-450 text-sm mt-1">Manage all your bookings from one place.</p>
            <p className="text-xs text-indigo-400 font-medium mt-1">Track events • Payments • Customers</p>
          </div>
          <div>
            <span className="flex items-center bg-indigo-650 text-white/50 font-medium text-sm px-4 py-2.5 rounded-xl cursor-not-allowed">
              <Plus size={16} className="mr-2 text-slate-500" />
              New Booking
            </span>
          </div>
        </div>

        {/* METRIC CARD GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </div>

        {/* LOWER SECTION GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <CalendarSkeleton />
          <DuesSkeleton />
        </div>

        {/* RECENT BOOKINGS LIST SECTION */}
        <TableSkeleton />
      </>
    )
  }

  return (
    <>
      <title>Dashboard | Smart Booking Pro</title>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
      {/* Business Control Panel Dashboard Header (MOBILE-FIRST HUB) */}
      <div className="space-y-6 mb-8 text-left">
        {/* Top Greeting and Business Info Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-black text-indigo-400 tracking-widest">{profile.business_name || 'Mookin Business'}</span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-0.5">
              {greeting}, Owner 👋
            </h1>
          </div>
        </div>

        {/* 2-Column Mobile-First Control Board */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Today's Summary & Metrics */}
          <div className="lg:col-span-2 bg-slate-900/30 backdrop-blur-xl border border-slate-900/40 p-6 sm:p-8 rounded-[24px] relative overflow-hidden shadow-2xl flex flex-col justify-between gap-6 min-h-[190px]">
            <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-purple-650/5 blur-[80px] pointer-events-none" />
            
            <div>
              <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Today's Summary</h2>
              
              {/* Daily questions & answers grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4.5 mt-4 text-xs font-sans">
                <div className="bg-slate-950/30 border border-slate-900/60 p-3.5 rounded-xl">
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Events Today</p>
                  <p className="text-lg font-black text-white mt-1">{todayBookings.length} Active</p>
                </div>
                <div className="bg-slate-950/30 border border-slate-900/60 p-3.5 rounded-xl">
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Pending Collection</p>
                  <p className="text-lg font-black text-amber-405 mt-1">₹{stats.totalDues.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-slate-950/30 border border-slate-900/60 p-3 rounded-xl min-w-0 flex flex-col justify-between">
                  <p className="text-slate-505 font-bold uppercase tracking-wider text-[10px]">Next Program</p>
                  {nextEvent ? (
                    <div className="mt-1 space-y-0.5 text-xs text-left">
                      <p className="font-extrabold text-white truncate">🪔 {nextEvent.program_name_snapshot || 'General Event'}</p>
                      <p className="text-slate-400 truncate">📍 {nextEvent.venue_address || 'Unspecified'}</p>
                      <p className="text-slate-400 font-medium">🕖 {nextEvent.start_time ? format12HourTime(nextEvent.start_time) : 'Time unspecified'}</p>
                      <p className="text-slate-450">👤 {nextEvent.customer_name}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 mt-2 text-left">No upcoming programs</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* KPI quick insight status row */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900/50 text-[11px] text-slate-450">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active bookings: {allBookings.filter(b => b.status === 'confirmed').length}
              </span>
              <span className="text-slate-650">•</span>
              <span className="inline-flex items-center gap-1.5">
                Month status: <span className="text-indigo-400 font-bold">Healthy</span>
              </span>
            </div>
          </div>

          {/* Right Column: Redesigned Quick Booking Premium glowing CTA card */}
          <div className="w-full lg:w-auto shrink-0">
            <Link href="/bookings?new=true" className="w-full block">
              <div className="w-full lg:w-[260px] bg-slate-900/30 backdrop-blur-xl border border-purple-500/30 hover:border-purple-500/50 rounded-[24px] p-6 relative overflow-hidden shadow-2xl shadow-purple-550/10 hover:shadow-purple-550/20 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] active:scale-98 min-h-[190px] cursor-pointer group">
                {/* Subtle animated background glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-indigo-600/5 opacity-50 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-60 h-60 rounded-full bg-purple-500/5 blur-[80px] pointer-events-none group-hover:scale-110 transition-transform duration-300" />
                
                <div className="relative z-10 flex flex-col items-center gap-3">
                  {/* Large plus icon with subtle animated glow */}
                  <div className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-650 to-indigo-650 flex items-center justify-center text-white shadow-lg shadow-purple-550/30 hover:shadow-purple-550/50 group-hover:scale-110 transition-all duration-300 relative">
                    <span className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping opacity-75 group-hover:animate-none scale-95" />
                    <Plus size={28} className="stroke-[3] relative z-10" />
                  </div>
                  
                  <div className="space-y-1 mt-1">
                    <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">New Booking</h3>
                    <p className="text-[10px] text-purple-200 font-medium">Create a new booking in seconds</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* TODAY'S EVENTS SECTION */}
      <div className="mb-8 text-left">
        <h2 className="text-lg font-bold text-white tracking-wide mb-4">Today's Events</h2>
        {todayBookings.length === 0 ? (
          <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-900/40 p-6.5 rounded-[20px] text-center shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl pointer-events-none" />
            <p className="text-slate-400 text-sm font-medium">You're free today. 🎉</p>
            <p className="text-slate-500 text-xs mt-1">Enjoy your time off or plan ahead with the Dues Tracker below.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {todayBookings.map((b) => {
              const isPaid = Number(b.remaining_amount) === 0
              
              return (
                <div 
                  key={b.id} 
                  className="bg-slate-900/30 backdrop-blur-xl border border-slate-850 p-5 rounded-[20px] shadow-xl hover:border-slate-800 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between gap-4 font-sans relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />
                  
                  <div className="space-y-3">
                    {/* Time and Status Pill */}
                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-900/50">
                      <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold">
                        <Clock size={12} className="text-indigo-400" />
                        <span>
                          {b.start_time && b.end_time
                            ? `${format12HourTime(b.start_time)} - ${format12HourTime(b.end_time)}`
                            : 'Time unspecified'}
                        </span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                        b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                        b.status === 'pending' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                        b.status === 'completed' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        'bg-rose-500/10 text-rose-455 border border-rose-500/20'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                    
                    {/* Event & Client Details */}
                    <div>
                      <h4 className="font-extrabold text-base text-white tracking-tight">{b.program_name_snapshot || 'General Event'}</h4>
                      <p className="text-xs text-slate-400 mt-1 font-medium">Client: {b.customer_name}</p>
                      {b.venue_address ? (
                        <p className="text-xs text-slate-500 mt-1 flex items-start gap-1 min-w-0">
                          <MapPin size={11} className="text-slate-600 mt-0.5 shrink-0" />
                          <span className="truncate" title={b.venue_address}>{b.venue_address}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-650 mt-1">No venue provided</p>
                      )}
                    </div>
                  </div>

                  {/* Payment Dues Balance Card */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-900/50 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Outstanding Dues</span>
                      <p className={`font-black text-sm mt-0.5 ${isPaid ? 'text-emerald-400' : 'text-amber-455'}`}>
                        {isPaid ? 'Paid in Full' : `₹${Number(b.remaining_amount).toLocaleString('en-IN')}`}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDate(b.event_date)
                        setSelectedBookings([b])
                        setShowPopup(true)
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-950/50 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-300 hover:text-white transition-all text-xs font-bold cursor-pointer active:scale-95 shadow-sm"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* METRIC CARD GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Bookings Card */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900/50 hover:border-slate-800/80 p-6 rounded-2xl flex items-center justify-between shadow-xl transition-all duration-350 hover:scale-[1.03] hover:-translate-y-0.5 group">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Bookings</p>
            <h3 className="text-3xl font-extrabold text-white mt-2.5 tracking-tight">{stats.totalBookings}</h3>
            <p className="text-xs text-indigo-400 font-semibold mt-1.5">{stats.confirmedBookings} Confirmed</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform duration-300 shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
            <Calendar size={22} />
          </div>
        </div>

        {/* Total Remaining Dues Card */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900/50 hover:border-slate-800/80 p-6 rounded-2xl flex items-center justify-between shadow-xl transition-all duration-350 hover:scale-[1.03] hover:-translate-y-0.5 group">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Remaining Dues</p>
            <h3 className="text-3xl font-extrabold text-white mt-2.5 tracking-tight">₹{stats.totalDues.toLocaleString('en-IN')}</h3>
            <p className="text-xs text-amber-450 font-semibold mt-1.5 flex items-center">
              <AlertCircle size={12} className="mr-1 shrink-0" /> Pending Collection
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform duration-300 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
            <IndianRupee size={22} />
          </div>
        </div>

        {/* Expenses This Month Card */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900/50 hover:border-slate-800/80 p-6 rounded-2xl flex items-center justify-between shadow-xl transition-all duration-350 hover:scale-[1.03] hover:-translate-y-0.5 group">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Expenses (Month)</p>
            <h3 className="text-3xl font-extrabold text-white mt-2.5 tracking-tight">₹{stats.monthlyExpenses.toLocaleString('en-IN')}</h3>
            <p className="text-xs text-rose-450 font-semibold mt-1.5 flex items-center">
              <TrendingDown size={12} className="mr-1 shrink-0" /> Outflow check
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/15 flex items-center justify-center text-rose-405 group-hover:scale-110 transition-transform duration-300 shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.25)]">
            <TrendingDown size={22} />
          </div>
        </div>

        {/* Target Status Card */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900/50 hover:border-slate-800/80 p-6 rounded-2xl flex items-center justify-between shadow-xl transition-all duration-350 hover:scale-[1.03] hover:-translate-y-0.5 group">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target Status</p>
            <h3 className="text-3xl font-extrabold text-white mt-2.5 tracking-tight">Healthy</h3>
            <p className="text-xs text-emerald-455 font-semibold mt-1.5 flex items-center">
              <TrendingUp size={12} className="mr-1 shrink-0" /> High conversion
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform duration-300 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* LOWER SECTION GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* PREMIUM COMPACT MINI CALENDAR (Left 2 cols on wide screen) */}
        <div className="lg:col-span-2 bg-slate-900/30 backdrop-blur-xl border border-slate-850 p-6 rounded-[24px] flex flex-col shadow-2xl relative overflow-hidden h-full">
          {/* Soft purple glow accents */}
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-purple-650/10 blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-indigo-650/10 blur-[100px] pointer-events-none" />

          {!mounted ? (
            <div className="flex-1 flex flex-col justify-center items-center min-h-[300px]">
              <Loader2 className="animate-spin h-8 w-8 text-indigo-500" />
            </div>
          ) : (
            <>
              {/* Compact Calendar Header Navigation */}
              <div className="flex items-center justify-between gap-4 mb-4 relative z-10">
                <div>
                  <h2 className="text-base font-extrabold text-white tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                    {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
                  <Link href="/calendar">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors mt-0.5 cursor-pointer uppercase tracking-wider">
                      Full Calendar View <ChevronRight size={10} />
                    </span>
                  </Link>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const d = new Date(currentMonth)
                      d.setMonth(d.getMonth() - 1)
                      setCurrentMonth(d)
                    }}
                    className="p-1.5 rounded-full border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all duration-150 cursor-pointer bg-slate-950/40 hover:bg-slate-900 active:scale-90"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  
                  <button
                    onClick={() => {
                      const d = new Date(currentMonth)
                      d.setMonth(d.getMonth() + 1)
                      setCurrentMonth(d)
                    }}
                    className="p-1.5 rounded-full border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all duration-150 cursor-pointer bg-slate-950/40 hover:bg-slate-900 active:scale-90"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-between relative z-10 font-sans">
                {/* Calendar Grid Header */}
                <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-center">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-1">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Compact Calendar Days Grid */}
                <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-[220px]">
                  {calendarCells.map((cell, idx) => {
                    const dateKey = formatDateToISOString(cell.date)
                    const cellBookings = bookingsByDate[dateKey] || []
                    const hasBookings = cellBookings.length > 0
                    
                    const isSelected = selectedDate === dateKey
                    const isToday = dateKey === todayStr

                    let cellStyle = `relative rounded-xl p-1 flex flex-col items-center justify-center h-10 w-full select-none transition-all duration-200 ease-out border text-center `

                    if (!cell.isCurrentMonth) {
                      cellStyle += `bg-slate-950/5 border-transparent text-slate-750 opacity-10 cursor-default`
                    } else if (isSelected) {
                      cellStyle += `bg-gradient-to-tr from-purple-650 to-indigo-650 border-transparent text-white shadow-lg shadow-purple-500/25 hover:scale-[1.05] active:scale-95 cursor-pointer`
                    } else {
                      cellStyle += `bg-slate-950/30 border-slate-900/60 text-slate-350 hover:border-slate-800 hover:bg-slate-900/10 hover:scale-[1.05] active:scale-95 cursor-pointer `
                      
                      if (isToday) {
                        cellStyle += `ring-2 ring-purple-500/80 shadow-[0_0_10px_rgba(168,85,247,0.4)] border-transparent bg-purple-500/5 `
                      }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (cellBookings.length > 0) {
                            setSelectedDate(dateKey)
                            setSelectedBookings(cellBookings)
                            setShowPopup(true)
                          }
                        }}
                        className={cellStyle}
                        disabled={!cell.isCurrentMonth}
                      >
                        <div className="flex flex-col items-center justify-center h-full w-full relative">
                          <span className={`text-xs font-extrabold ${
                            !cell.isCurrentMonth ? '' : isSelected ? 'text-white' : isToday ? 'text-purple-400' : 'text-slate-400'
                          }`}>
                            {cell.dayNumber}
                          </span>
                          
                          {cell.isCurrentMonth && hasBookings && (
                            <span className="absolute bottom-0.5 flex gap-0.5 justify-center items-center">
                              {cellBookings.slice(0, 3).map((b) => {
                                let dotColor = 'bg-slate-500'
                                if (b.status === 'confirmed') dotColor = 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]'
                                else if (b.status === 'pending') dotColor = 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]'
                                else if (b.status === 'completed') dotColor = 'bg-indigo-500 shadow-[0_0_4px_rgba(99,102,241,0.5)]'
                                else if (b.status === 'cancelled') dotColor = 'bg-rose-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]'
                                return (
                                  <span key={b.id} className={`w-1 h-1 rounded-full shrink-0 ${dotColor}`} />
                                )
                              })}
                            </span>
                          )}

                          {cell.isCurrentMonth && cellBookings.length > 1 && (
                            <span className={`absolute -top-1.5 -right-1 text-[7px] font-black px-1 py-0.2 rounded-full scale-75 shrink-0 ${
                              isSelected ? 'bg-white text-purple-650' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            }`}>
                              {cellBookings.length}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* DUES TRACKER (Right 1 col) */}
        <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-850 p-6 rounded-[24px] flex flex-col shadow-2xl h-full relative overflow-hidden">
          {/* Subtle accent glow */}
          <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-indigo-650/5 blur-[80px] pointer-events-none" />

          <div className="mb-6 relative z-10">
            <h2 className="text-xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Dues Tracker</h2>
            <p className="text-slate-400 text-[11px] font-medium mt-0.5">Urgent collection notifications</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[350px] pr-1 relative z-10">
            {dueBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center">
                <Clock className="stroke-[1.5] h-10 w-10 text-slate-650 mb-3 animate-pulse" />
                <p className="text-xs font-bold text-white">No remaining dues found!</p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[160px]">All collections have been completed successfully.</p>
              </div>
            ) : (
              dueBookings.map((b) => {
                const initials = b.customer_name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || '👤'

                return (
                  <div 
                    key={b.id} 
                    className="flex items-center justify-between p-3.5 bg-slate-950/45 border border-slate-900/80 hover:border-slate-850 hover:bg-slate-900/50 backdrop-blur-md transition-all duration-200 hover:scale-[1.02] rounded-xl group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Customer Avatar initials */}
                      <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-350 font-extrabold text-xs shrink-0 shadow-inner group-hover:border-slate-800 transition-colors">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{b.customer_name}</p>
                        <p className="text-[10px] text-slate-450 mt-0.5">{formatIndianDate(b.event_date)}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {/* Due Badge */}
                      <span className="inline-block text-[10px] font-black text-amber-450 bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded-full leading-none">
                        ₹{Number(b.remaining_amount).toLocaleString('en-IN')}
                      </span>
                      <Link href={`/bookings?edit=${b.id}`}>
                        <span className="inline-flex items-center justify-center px-3 py-1 bg-indigo-500/10 hover:bg-indigo-500 border border-indigo-500/20 hover:border-transparent text-indigo-400 hover:text-white rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer shadow-sm active:scale-95">
                          Collect <ChevronRight size={10} className="ml-0.5" />
                        </span>
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>

      {/* RECENT BOOKINGS LIST SECTION */}
      <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-850 p-6 rounded-[24px] mt-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">Recent Bookings</h2>
            <p className="text-slate-400 text-xs mt-0.5">Quick status preview of latest logs</p>
          </div>
          <Link href="/bookings">
            <span className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center cursor-pointer">
              View All <ChevronRight size={16} className="ml-1" />
            </span>
          </Link>
        </div>

        <div className="overflow-x-auto">
          {recentBookings.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-sm">No recent bookings logged yet.</p>
              <p className="text-xs text-slate-650 mt-1">Get started by creating a new program and booking.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-900/60 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Client Name</th>
                  <th className="py-3.5 px-4">Event Date</th>
                  <th className="py-3.5 px-4">Service Category</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Dues Status</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-900/40">
                {recentBookings.map((b) => {
                  const initials = b.customer_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || '👤'
                  
                  return (
                    <tr key={b.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8.5 h-8.5 rounded-full bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-350 font-bold text-xs shrink-0 shadow-inner">
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white leading-none">{b.customer_name}</p>
                            <p className="text-xs text-slate-500 font-normal mt-0.5">{b.mobile_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{formatIndianDate(b.event_date)}</td>
                      <td className="py-3.5 px-4 text-slate-400">
                        <span className="px-2.5 py-1 bg-slate-950/40 rounded-lg border border-slate-900 text-xs">
                          {b.program_name_snapshot || 'General Service'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-white font-semibold">₹{Number(b.total_amount).toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4">
                        {Number(b.remaining_amount) > 0 ? (
                          <span className="text-amber-450 font-bold text-xs">
                            ₹{Number(b.remaining_amount).toLocaleString('en-IN')} pending
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold text-xs">Paid</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                          b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-445 border border-emerald-500/20' :
                          b.status === 'pending' ? 'bg-amber-500/10 text-amber-445 border border-amber-500/20' :
                          b.status === 'completed' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                          'bg-rose-500/10 text-rose-455 border border-rose-500/20'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* DYNAMIC CALENDAR DATE BOOKINGS LIST MODAL OVERLAY */}
      {showPopup && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/40">
              <div>
                <h3 className="font-extrabold text-xl text-white tracking-tight">Event Schedule Details</h3>
                <p className="text-xs text-purple-400 font-semibold mt-1">📅 {formatIndianDate(selectedDate)} • {selectedBookings.length} active slot{selectedBookings.length !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => {
                  setShowPopup(false)
                  setSelectedDate(null)
                  setSelectedBookings([])
                }}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer animate-in duration-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto font-sans">
              {selectedBookings.map((b) => {
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
                  <div key={b.id} className="bg-slate-950/40 border border-slate-850 rounded-2xl overflow-hidden shadow-lg p-5 space-y-6 relative">
                    {/* Top Hero Section */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-900">
                      <div>
                        <h4 className="text-lg font-bold text-white tracking-tight">{b.program_name_snapshot || 'General Event'}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{formatIndianDate(b.event_date)}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto tracking-wide uppercase ${
                        b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                        b.status === 'pending' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                        b.status === 'completed' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
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
                        <div className="flex items-center gap-3.5 bg-slate-955/35 p-3 rounded-xl border border-slate-900/60">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-650 to-indigo-650 flex items-center justify-center text-white font-extrabold text-xs shadow-md">
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
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-300 hover:text-white transition-colors text-xs font-semibold active:scale-95"
                          >
                            <Phone size={12} className="text-indigo-400" /> Call Client
                          </a>
                          <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-350 hover:text-white transition-colors text-xs font-semibold active:scale-95"
                          >
                            <Share2 size={12} className="text-emerald-400" /> WhatsApp
                          </a>
                        </div>
                      </div>

                      {/* Event details */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block">Event Schedule</span>
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
                                    className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-350 inline-flex items-center mt-1"
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
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${isPaid ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-450 border border-amber-500/20 animate-pulse'}`}>
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
                        <div className={`border p-3 rounded-xl text-center shadow-sm ${isPaid ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-amber-500/5 border-amber-500/25'}`}>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Balance</p>
                          <p className={`text-sm font-extrabold mt-1 ${isPaid ? 'text-emerald-400' : 'text-amber-400'}`}>₹{Number(b.remaining_amount).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Inner Actions */}
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-900">
                      <Link href={`/bookings`}>
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-300 hover:text-white transition-colors text-xs font-semibold cursor-pointer">
                          <Eye size={12} className="text-slate-400" /> View List
                        </span>
                      </Link>
                      <Link href={`/bookings?edit=${b.id}`}>
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-350 hover:text-white transition-colors text-xs font-semibold cursor-pointer">
                          <Edit2 size={12} className="text-purple-400" /> Edit Booking
                        </span>
                      </Link>
                      <button
                        onClick={() => {
                          toast.promise(
                            downloadBookingPDF(b as any, profile),
                            {
                              loading: 'Generating Invoice PDF...',
                              success: 'PDF Invoice downloaded successfully!',
                              error: 'Failed to generate PDF'
                            }
                          )
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-650 hover:bg-purple-700 text-white transition-all text-xs font-bold cursor-pointer active:scale-95 shadow-md shadow-purple-650/15"
                      >
                        <FileDown size={12} /> Invoice PDF
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end items-center px-6 py-4.5 border-t border-slate-800 bg-slate-950/20 gap-3">
              <button
                onClick={() => {
                  setShowPopup(false)
                  setSelectedDate(null)
                  setSelectedBookings([])
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-850 hover:border-slate-700 hover:bg-slate-900 text-slate-400 hover:text-white transition-colors text-xs font-semibold cursor-pointer active:scale-95"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
