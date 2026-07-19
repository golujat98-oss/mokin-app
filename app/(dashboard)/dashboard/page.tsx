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
  CheckCircle,
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
import { useRouter } from 'next/navigation'
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
  const paddedDay = String(day).padStart(2, '0')
  return `${paddedDay} ${months[monthIdx]} ${year}`
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

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  
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
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
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

  const upcomingBookings = useMemo(() => {
    const active = allBookings.filter(b => b.status !== 'cancelled' && b.event_date >= todayStr)
    const sorted = [...active].sort((a, b) => a.event_date.localeCompare(b.event_date))
    return sorted.slice(0, 5)
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
      <div className="space-y-6 text-left">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
          <div className="space-y-2">
            <div className="h-3 bg-slate-800 rounded w-24 animate-pulse" />
            <div className="h-8 bg-slate-800 rounded w-64 animate-pulse" />
          </div>
          <div className="h-10 bg-slate-800 rounded w-32 animate-pulse" />
        </div>

        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </div>

        {/* Dashboard Control/Summary Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[140px] bg-slate-900/30 rounded-3xl animate-pulse" />
          <div className="h-[140px] bg-slate-900/30 rounded-3xl animate-pulse" />
        </div>

        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[320px] bg-slate-900/30 rounded-3xl animate-pulse" />
          <div className="h-[320px] bg-slate-900/30 rounded-3xl animate-pulse" />
        </div>

        {/* Recent Bookings Skeleton */}
        <TableSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6 text-left pb-12 font-sans select-none max-w-7xl mx-auto">
      <title>Dashboard | Smart Booking Pro</title>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      {/* 1. Header Hero (Greeting + Profile Metadata Card) */}
      <div className="bg-gradient-to-r from-purple-950/10 via-indigo-950/10 to-slate-950/20 border border-white/[0.06] rounded-[24px] p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Decorative lights */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-purple-500/10 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent px-2.5 py-0.8 bg-purple-500/10 rounded-full border border-purple-500/10 inline-block mb-1">
              {profile.business_name || 'Smart Booking Business'}
            </span>
            <h1 className="text-2xl sm:text-4.5xl font-black text-white tracking-tight flex items-center gap-2">
              {greeting} 👋
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm font-medium">
              Welcome back to your dashboard control panel.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-xs text-slate-500 font-semibold">
              <span className="flex items-center gap-1">📅 {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span>•</span>
              <span className="flex items-center gap-1">🟢 {todayBookings.length} event{todayBookings.length !== 1 ? 's' : ''} today</span>
            </div>
          </div>

          {/* Quick Actions (CTA Box) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Link href="/bookings?new=true" className="sm:w-auto">
              <button className="w-full sm:w-auto relative group overflow-hidden flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-xs tracking-wider uppercase transition-all duration-300 hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] active:scale-95 cursor-pointer shadow-md">
                <Plus size={14} className="stroke-[3.5] relative z-10" />
                <span className="relative z-10">New Booking</span>
              </button>
            </Link>
            <Link href="/calendar" className="sm:w-auto">
              <button className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white font-extrabold text-xs tracking-wider uppercase transition-all active:scale-95 cursor-pointer">
                View Calendar
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Premium SaaS Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Total Bookings Card (Indigo Theme) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push('/bookings')}
          onKeyDown={(e) => e.key === 'Enter' && router.push('/bookings')}
          className="bg-slate-950/40 backdrop-blur-xl border border-white/[0.05] hover:border-indigo-500/35 p-3.5 sm:p-5 rounded-2xl flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)] group relative overflow-hidden w-full cursor-pointer active:scale-[0.98] outline-none focus:ring-1 focus:ring-indigo-500/50"
        >
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-indigo-500/[0.03] blur-xl pointer-events-none group-hover:bg-indigo-500/[0.06] transition-colors" />
          <div className="space-y-1 relative z-10 min-w-0 flex-1 text-left">
            <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest block truncate">Total Bookings</span>
            <h3 className="text-xl sm:text-3xl font-black text-white tracking-tight">{stats.totalBookings}</h3>
            <span className="text-[8px] sm:text-[10px] text-slate-400 font-medium block truncate mt-0.5">Total bookings</span>
          </div>
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 group-hover:scale-110 transition-all duration-300 shrink-0 ml-1 relative z-10">
            <Calendar size={16} className="sm:hidden" />
            <Calendar size={20} className="hidden sm:block stroke-[2]" />
          </div>
        </div>

        {/* Pending Bookings Card (Amber Theme) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push('/bookings?status=pending')}
          onKeyDown={(e) => e.key === 'Enter' && router.push('/bookings?status=pending')}
          className="bg-slate-950/40 backdrop-blur-xl border border-white/[0.05] hover:border-amber-500/35 p-3.5 sm:p-5 rounded-2xl flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(245,158,11,0.12)] group relative overflow-hidden w-full cursor-pointer active:scale-[0.98] outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-amber-500/[0.03] blur-xl pointer-events-none group-hover:bg-amber-500/[0.06] transition-colors" />
          <div className="space-y-1 relative z-10 min-w-0 flex-1 text-left">
            <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest block truncate">Pending Bookings</span>
            <h3 className="text-xl sm:text-3xl font-black text-amber-450 tracking-tight">{allBookings.filter(b => b.status === 'pending').length}</h3>
            <span className="text-[8px] sm:text-[10px] text-slate-400 font-medium block truncate mt-0.5">Waiting for confirmation</span>
          </div>
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center text-amber-450 group-hover:bg-amber-500/10 group-hover:border-amber-500/20 group-hover:scale-110 transition-all duration-300 shrink-0 ml-1 relative z-10">
            <Clock size={16} className="sm:hidden" />
            <Clock size={20} className="hidden sm:block stroke-[2]" />
          </div>
        </div>

        {/* Completed Bookings Card (Green Theme) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push('/bookings?status=completed')}
          onKeyDown={(e) => e.key === 'Enter' && router.push('/bookings?status=completed')}
          className="bg-slate-950/40 backdrop-blur-xl border border-white/[0.05] hover:border-emerald-500/35 p-3.5 sm:p-5 rounded-2xl flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)] group relative overflow-hidden w-full cursor-pointer active:scale-[0.98] outline-none focus:ring-1 focus:ring-emerald-500/50"
        >
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-emerald-500/[0.03] blur-xl pointer-events-none group-hover:bg-emerald-500/[0.06] transition-colors" />
          <div className="space-y-1 relative z-10 min-w-0 flex-1 text-left">
            <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest block truncate">Completed Bookings</span>
            <h3 className="text-xl sm:text-3xl font-black text-emerald-400 tracking-tight">{allBookings.filter(b => b.status === 'completed' || b.status === 'confirmed').length}</h3>
            <span className="text-[8px] sm:text-[10px] text-slate-400 font-medium block truncate mt-0.5">Successfully completed</span>
          </div>
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 group-hover:scale-110 transition-all duration-300 shrink-0 ml-1 relative z-10">
            <CheckCircle size={16} className="sm:hidden" />
            <CheckCircle size={20} className="hidden sm:block stroke-[2]" />
          </div>
        </div>

        {/* Remaining Dues Card (Red Theme) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push('/bookings?filter=dues')}
          onKeyDown={(e) => e.key === 'Enter' && router.push('/bookings?filter=dues')}
          className="bg-slate-950/40 backdrop-blur-xl border border-white/[0.05] hover:border-rose-500/35 p-3.5 sm:p-5 rounded-2xl flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(239,68,68,0.12)] group relative overflow-hidden w-full cursor-pointer active:scale-[0.98] outline-none focus:ring-1 focus:ring-rose-500/50"
        >
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-rose-500/[0.03] blur-xl pointer-events-none group-hover:bg-rose-500/[0.06] transition-colors" />
          <div className="space-y-1 relative z-10 min-w-0 flex-1 text-left">
            <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest block truncate">Remaining Dues</span>
            <h3 className="text-xl sm:text-3xl font-black text-rose-455 tracking-tight truncate">₹{stats.totalDues.toLocaleString('en-IN')}</h3>
            <span className="text-[8px] sm:text-[10px] text-slate-400 font-medium block truncate mt-0.5">Pending collection</span>
          </div>
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-rose-500/5 border border-rose-500/10 flex items-center justify-center text-rose-455 shrink-0 ml-1 relative z-10">
            <IndianRupee size={16} className="sm:hidden" />
            <IndianRupee size={20} className="hidden sm:block stroke-[2]" />
          </div>
        </div>
      </div>

      {/* 3. Today's Summary & Quick Control Board Widget */}
      <div className="bg-[#0b1020]/30 backdrop-blur-xl border border-white/[0.04] p-5 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-purple-500/5 blur-[80px] pointer-events-none" />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Summary Items Grid */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/20 border border-white/[0.04] p-4 rounded-2xl flex flex-col justify-between">
              <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Today's Summary</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-white">{todayBookings.length}</span>
                <span className="text-xs text-slate-400 font-semibold">Active Event{todayBookings.length !== 1 ? 's' : ''} Today</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active bookings: {allBookings.filter(b => b.status === 'confirmed').length}
              </span>
            </div>

            <div className="bg-slate-950/20 border border-white/[0.04] p-4 rounded-2xl flex flex-col justify-between">
              <p className="text-slate-550 font-bold uppercase tracking-wider text-[10px]">Financial Status</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-amber-405">₹{stats.totalDues.toLocaleString('en-IN')}</span>
                <span className="text-xs text-slate-405 font-semibold">Outstanding Balance</span>
              </div>
              <span className="text-[10px] text-slate-450 mt-2 block font-medium">
                Business health status: <span className="text-indigo-400 font-black">Healthy</span>
              </span>
            </div>
          </div>

          {/* Next Event Quick View */}
          <div className="bg-slate-950/20 border border-white/[0.04] p-4 rounded-2xl flex flex-col justify-between">
            <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Next Program</p>
            {nextEvent ? (
              <div className="mt-2 space-y-1 text-xs text-left">
                <p className="font-extrabold text-white truncate">🎂 {nextEvent.program_name_snapshot || 'General Event'}</p>
                <p className="text-indigo-400 font-bold">📅 {formatIndianDate(nextEvent.event_date)}</p>
                <p className="text-slate-400 font-medium">🕗 {nextEvent.start_time ? format12HourTime(nextEvent.start_time) : 'Time unspecified'}</p>
                <p className="text-slate-455 truncate">📍 {nextEvent.venue_address || 'Unspecified location'}</p>
                <p className="text-slate-455 font-semibold mt-1">👤 {nextEvent.customer_name}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-2 text-left italic">No upcoming programs scheduled.</p>
            )}
          </div>
        </div>
      </div>

      {/* 4. Main Compact Schedule Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COMPACT MINI CALENDAR & PROGRAMS WIDGET (Left 2 cols) */}
        <div className="lg:col-span-2 bg-[#0b1020]/30 backdrop-blur-xl border border-white/[0.04] p-5 rounded-[24px] flex flex-col shadow-2xl relative overflow-hidden min-h-[380px]">
          {/* Subtle neon accents */}
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-purple-500/[0.08] blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-indigo-500/[0.08] blur-[80px] pointer-events-none" />

          {!mounted ? (
            <div className="flex-1 flex flex-col justify-center items-center">
              <Loader2 className="animate-spin h-8 w-8 text-indigo-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full relative z-10">
              
              {/* Left Column: Mini Calendar Date Grid */}
              <div className="flex flex-col justify-between gap-4 border-b md:border-b-0 md:border-r border-white/[0.04] pb-5 md:pb-0 md:pr-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-white tracking-tight uppercase">
                    {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
                        setCurrentMonth(d)
                      }}
                      className="p-1 rounded-full border border-white/[0.06] hover:bg-white/[0.06] text-slate-400 hover:text-white transition-all duration-150 cursor-pointer"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      onClick={() => {
                        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                        setCurrentMonth(d)
                      }}
                      className="p-1 rounded-full border border-white/[0.06] hover:bg-white/[0.06] text-slate-400 hover:text-white transition-all duration-150 cursor-pointer"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-slate-550 uppercase tracking-widest mb-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                    <div key={`${d}-${idx}`} className="py-0.5">{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 flex-1">
                  {calendarCells.map((cell, idx) => {
                    const dateKey = formatDateToISOString(cell.date)
                    const cellBookings = bookingsByDate[dateKey] || []
                    const hasBookings = cellBookings.length > 0
                    const isSelected = selectedDate === dateKey
                    const isToday = dateKey === todayStr

                    let cellStyle = `min-h-[46px] w-full rounded-xl text-xs font-bold transition-all relative flex flex-col items-center justify-between p-1 cursor-pointer select-none `
                    if (!cell.isCurrentMonth) {
                      cellStyle += `text-slate-800 opacity-20 cursor-default hover:bg-transparent pointer-events-none`
                    } else if (isSelected) {
                      cellStyle += `bg-indigo-650 text-white shadow-md shadow-indigo-600/20 scale-105`
                    } else {
                      cellStyle += `bg-slate-900/40 border border-slate-900/50 text-slate-350 hover:bg-slate-900 hover:border-slate-800 `
                      if (isToday) {
                        cellStyle += `ring-1.5 ring-indigo-500/80 bg-indigo-500/5 shadow-[0_0_8px_rgba(99,102,241,0.25)] text-indigo-400 border-transparent`
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={!cell.isCurrentMonth}
                        onClick={() => {
                          if (cellBookings.length > 0) {
                            setSelectedDate(dateKey)
                            setSelectedBookings(cellBookings)
                            setShowPopup(true)
                          }
                        }}
                        className={cellStyle}
                      >
                        <span className="text-[10px] leading-none font-extrabold">{cell.dayNumber}</span>
                        {cell.isCurrentMonth && hasBookings ? (
                          <div className="w-full text-[8px] font-bold text-center leading-none text-slate-300 truncate mt-0.5" title={cellBookings.map(b => `${b.customer_name} (${b.program_name_snapshot || 'Event'})`).join(', ')}>
                            {(() => {
                              const firstBooking = cellBookings[0]
                              const emoji = getServiceIcon(firstBooking.program_name_snapshot)
                              const name = firstBooking.program_name_snapshot || firstBooking.customer_name || 'Event'
                              return `${emoji} ${name}`
                            })()}
                          </div>
                        ) : (
                          <div className="h-2 w-2" />
                        )}
                        {cell.isCurrentMonth && cellBookings.length > 1 && (
                          <span className="absolute top-0.5 right-1 text-[7px] font-black text-indigo-400 leading-none">
                            +{cellBookings.length - 1}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="pt-2">
                  <Link href="/calendar" className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.06] text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-wider transition-all active:scale-[0.98]">
                    <Calendar size={12} /> View Full Calendar
                  </Link>
                </div>
              </div>

              {/* Right Column: Today's & Upcoming Programs Lists */}
              <div className="flex flex-col justify-between gap-4">
                <div className="space-y-4">
                  {/* Today's Programs section */}
                  <div>
                    <h4 className="text-[10px] font-black text-slate-405 uppercase tracking-widest mb-2">Today's Programs</h4>
                    <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                      {todayBookings.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-1.5">No programs scheduled for today.</p>
                      ) : (
                        todayBookings.map((b) => (
                          <div key={b.id} className="flex items-center justify-between p-2 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl">
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-black text-white truncate">{b.program_name_snapshot || 'General Event'}</p>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">👤 {b.customer_name}</p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedDate(b.event_date)
                                setSelectedBookings([b])
                                setShowPopup(true)
                              }}
                              className="px-2 py-0.8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-[9px] font-black hover:bg-emerald-500 hover:text-white transition-colors uppercase tracking-wider"
                            >
                              View
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Upcoming Programs section */}
                  <div>
                    <h4 className="text-[10px] font-black text-slate-405 uppercase tracking-widest mb-2">Upcoming Programs</h4>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {upcomingBookings.filter(b => b.event_date > todayStr).length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-1.5">No upcoming programs scheduled.</p>
                      ) : (
                        upcomingBookings.filter(b => b.event_date > todayStr).slice(0, 3).map((b) => (
                          <div key={b.id} className="flex items-center justify-between p-2 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:bg-white/[0.04] transition-colors">
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-black text-white truncate">{b.program_name_snapshot || 'General Event'}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-slate-455">
                                <span className="font-extrabold text-slate-400">{formatIndianDate(b.event_date)}</span>
                                <span>•</span>
                                <span className="truncate">👤 {b.customer_name}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedDate(b.event_date)
                                setSelectedBookings([b])
                                setShowPopup(true)
                              }}
                              className="px-2 py-0.8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-350 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all"
                            >
                              View
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* DUES TRACKER (Right 1 col) */}
        <div className="bg-[#0b1020]/30 backdrop-blur-xl border border-white/[0.04] p-5 rounded-[24px] flex flex-col shadow-2xl min-h-[380px] relative overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-indigo-500/5 blur-[80px] pointer-events-none" />

          <div className="mb-4 relative z-10">
            <h2 className="text-base font-extrabold text-white tracking-tight uppercase">Dues Tracker</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Urgent collection checks</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-1 relative z-10">
            {dueBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center">
                <Clock className="stroke-[1.5] h-9 w-9 text-slate-650 mb-2 animate-pulse" />
                <p className="text-xs font-black text-white">No remaining dues</p>
                <p className="text-[9px] text-slate-500 mt-1 max-w-[150px]">All pending collections have been completed.</p>
              </div>
            ) : (
              dueBookings.map((b) => {
                const initials = b.customer_name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || '👤'

                const total = Number(b.total_amount) || 1
                const paid = Number(b.advance_amount) || 0
                const paidPercent = Math.min(100, Math.max(0, Math.round((paid / total) * 100)))

                return (
                  <div 
                    key={b.id} 
                    className="p-3.5 bg-slate-950/40 border border-white/[0.04] hover:border-white/[0.08] hover:bg-slate-900/20 transition-all duration-250 rounded-2xl group flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8.5 h-8.5 rounded-full bg-slate-900 border border-white/[0.05] flex items-center justify-center text-slate-300 font-extrabold text-xs shrink-0 group-hover:border-slate-800 transition-colors">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-white truncate">{b.customer_name}</p>
                          <p className="text-[9px] text-slate-500 font-bold mt-0.5">{formatIndianDate(b.event_date)}</p>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <span className="inline-block text-[10px] font-black text-amber-450 bg-amber-500/10 border border-amber-500/15 px-2.5 py-0.5 rounded-full leading-none">
                          ₹{Number(b.remaining_amount).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                        <span>Paid Progress</span>
                        <span>{paidPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                        <div className="bg-indigo-500 h-1 rounded-full transition-all duration-500" style={{ width: `${paidPercent}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.02] mt-0.5">
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">
                        {b.program_name_snapshot || 'General Event'}
                      </span>
                      <Link href={`/bookings?edit=${b.id}`}>
                        <span className="inline-flex items-center justify-center px-3 py-1 bg-indigo-500/10 hover:bg-indigo-500 border border-indigo-500/15 hover:border-transparent text-indigo-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer active:scale-95">
                          Collect Dues <ChevronRight size={8} className="ml-0.5" />
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

      {/* 5. RECENT BOOKINGS LIST SECTION */}
      <div className="bg-[#0b1020]/30 backdrop-blur-xl border border-white/[0.04] p-5 rounded-[24px] shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-white tracking-tight uppercase">Recent Bookings</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Quick preview of latest logs</p>
          </div>
          <Link href="/bookings">
            <span className="text-xs font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider flex items-center cursor-pointer">
              View All <ChevronRight size={12} className="ml-0.5" />
            </span>
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-slate-950/20 shadow-inner">
          {recentBookings.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-xs">No recent bookings logged.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[350px] scrollbar-none">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-slate-950/80 text-[9px] font-black text-slate-450 uppercase tracking-widest sticky top-0 z-10 backdrop-blur-md">
                    <th className="py-3.5 px-4">Client</th>
                    <th className="py-3.5 px-4">Scheduled Date</th>
                    <th className="py-3.5 px-4">Program Category</th>
                    <th className="py-3.5 px-4">Pricing</th>
                    <th className="py-3.5 px-4">Ledger Dues</th>
                    <th className="py-3.5 px-4">Workflow Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02] bg-transparent">
                  {recentBookings.map((b) => {
                    const initials = b.customer_name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || '👤'
                    
                    return (
                      <tr key={b.id} className="hover:bg-white/[0.02] transition-colors duration-150 group">
                        <td className="py-3.5 px-4 font-medium text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8.5 h-8.5 rounded-full bg-slate-900 border border-white/[0.04] flex items-center justify-center text-slate-350 font-black text-[10px] shrink-0 group-hover:border-slate-800 transition-colors">
                              {initials}
                            </div>
                            <div>
                              <p className="font-extrabold text-white leading-none">{b.customer_name}</p>
                              <p className="text-[10px] text-slate-500 font-bold mt-1 leading-none">{b.mobile_number}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-355 font-bold">{formatIndianDate(b.event_date)}</td>
                        <td className="py-3.5 px-4 text-slate-400">
                          <span className="px-2.5 py-0.8 bg-slate-900/60 rounded-lg border border-white/[0.04] text-[10px] font-semibold text-indigo-400">
                            {b.program_name_snapshot || 'General Service'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-white font-extrabold">₹{Number(b.total_amount).toLocaleString('en-IN')}</td>
                        <td className="py-3.5 px-4">
                          {Number(b.remaining_amount) > 0 ? (
                            <span className="text-amber-450 font-extrabold bg-amber-500/5 px-2.5 py-0.5 rounded-md border border-amber-500/10">
                              ₹{Number(b.remaining_amount).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-extrabold bg-emerald-500/5 px-2.5 py-0.5 rounded-md border border-emerald-500/10">
                              Paid
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.8 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                            b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' :
                            b.status === 'pending' ? 'bg-amber-500/10 text-amber-450 border-amber-500/20' :
                            b.status === 'completed' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                            'bg-rose-500/10 text-rose-455 border-rose-500/20'
                          }`}>
                            <span className={`w-1 h-1 rounded-full mr-1.5 shrink-0 ${
                              b.status === 'confirmed' ? 'bg-emerald-500' :
                              b.status === 'pending' ? 'bg-amber-500' :
                              b.status === 'completed' ? 'bg-indigo-500' :
                              'bg-rose-500'
                            }`} />
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
                        <span className="text-[10px] font-bold text-slate-555 uppercase tracking-wider block">Event Schedule</span>
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
                        <span className="text-[10px] font-bold text-slate-505 uppercase tracking-wider">Payment Breakdown</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${isPaid ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-450 border border-amber-500/20 animate-pulse'}`}>
                          {isPaid ? 'PAID' : 'DUE'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-955/20 border border-slate-900/60 p-3 rounded-xl text-center shadow-sm">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Total</p>
                          <p className="text-sm font-bold text-white mt-1">₹{Number(b.total_amount).toLocaleString('en-IN')}</p>
                        </div>
                        <div className="bg-slate-955/20 border border-slate-900/60 p-3 rounded-xl text-center shadow-sm">
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
      {/* Floating Action Button (FAB) for Mobile Quick Bookings */}
      <div className="md:hidden fixed bottom-24 right-4 z-40">
        <Link href="/bookings?new=true">
          <button className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-650 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer">
            <Plus size={22} className="stroke-[3.5]" />
          </button>
        </Link>
      </div>
    </div>
  )
}
