'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar,
  IndianRupee,
  TrendingUp,
  AlertCircle,
  Plus,
  Loader2,
  ChevronRight,
  TrendingDown,
  Clock
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { toast, Toaster } from 'react-hot-toast'
import Link from 'next/link'

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
}

interface Expense {
  id: string
  amount: number
  expense_date: string
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
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .order('event_date', { ascending: true })

      // Get expenses this month
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      const startOfMonthStr = startOfMonth.toISOString().split('T')[0]
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', startOfMonthStr)

      // Calculate statistics
      let totalBookings = 0
      let confirmedBookings = 0
      let totalDues = 0
      const activeBookingsList: Booking[] = []
      const duesList: Booking[] = []

      if (bookings) {
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
      }

      let monthlyExpenses = 0
      if (expenses) {
        expenses.forEach((expense: Expense) => {
          monthlyExpenses += Number(expense.amount)
        })
      }

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

      // Build charts data (financial analysis over past 6 months)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const past6Months = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        return {
          monthIndex: d.getMonth(),
          year: d.getFullYear(),
          label: `${months[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`,
          revenue: 0,
          expenses: 0
        }
      }).reverse()

      // Fetch all bookings/expenses for chart over past 6 months
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]

      const { data: chartBookings } = await supabase
        .from('bookings')
        .select('*')
        .gte('event_date', sixMonthsAgoStr)

      const { data: chartExpenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', sixMonthsAgoStr)

      past6Months.forEach((item) => {
        if (chartBookings) {
          chartBookings.forEach((b: any) => {
            const bDate = new Date(b.event_date)
            if (bDate.getMonth() === item.monthIndex && bDate.getFullYear() === item.year && b.status !== 'cancelled') {
              item.revenue += Number(b.total_amount)
            }
          })
        }
        if (chartExpenses) {
          chartExpenses.forEach((e: any) => {
            const eDate = new Date(e.expense_date)
            if (eDate.getMonth() === item.monthIndex && eDate.getFullYear() === item.year) {
              item.expenses += Number(e.amount)
            }
          })
        }
      })

      setChartData(past6Months)

    } catch (err) {
      console.error(err)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
        Loading metrics...
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
      
      {/* Upper header action bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Here is a quick look at your booking business.</p>
        </div>
        <div>
          <Link href="/bookings?new=true">
            <span className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/15 active:scale-95 cursor-pointer">
              <Plus size={16} className="mr-2" />
              New Booking
            </span>
          </Link>
        </div>
      </div>

      {/* METRIC CARD GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Bookings Card */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-900 p-5 rounded-2xl flex items-center justify-between shadow-xl">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Bookings</p>
            <h3 className="text-2xl font-bold text-white mt-2">{stats.totalBookings}</h3>
            <p className="text-xs text-indigo-400 font-medium mt-1">{stats.confirmedBookings} Confirmed</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center text-indigo-400">
            <Calendar size={22} />
          </div>
        </div>

        {/* Total Remaining Dues Card */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-900 p-5 rounded-2xl flex items-center justify-between shadow-xl">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Remaining Dues</p>
            <h3 className="text-2xl font-bold text-white mt-2">₹{stats.totalDues.toLocaleString('en-IN')}</h3>
            <p className="text-xs text-amber-500 font-medium mt-1 flex items-center">
              <AlertCircle size={12} className="mr-1" /> Dues collection pending
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center text-amber-400">
            <IndianRupee size={22} />
          </div>
        </div>

        {/* Expenses This Month Card */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-900 p-5 rounded-2xl flex items-center justify-between shadow-xl">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Expenses (Month)</p>
            <h3 className="text-2xl font-bold text-white mt-2">₹{stats.monthlyExpenses.toLocaleString('en-IN')}</h3>
            <p className="text-xs text-rose-400 font-medium mt-1 flex items-center">
              <TrendingDown size={12} className="mr-1" /> Outflow check
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/15 flex items-center justify-center text-rose-400">
            <TrendingDown size={22} />
          </div>
        </div>

        {/* Performance Index Card */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-900 p-5 rounded-2xl flex items-center justify-between shadow-xl">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Status</p>
            <h3 className="text-2xl font-bold text-white mt-2">Healthy</h3>
            <p className="text-xs text-emerald-400 font-medium mt-1 flex items-center">
              <TrendingUp size={12} className="mr-1" /> High conversion
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center text-emerald-400">
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* LOWER SECTION GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FINANCIAL REVENUE CHART (Left 2 cols on wide screen) */}
        <div className="lg:col-span-2 bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 rounded-2xl flex flex-col shadow-xl">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white tracking-wide">6-Month Trend</h2>
            <p className="text-slate-400 text-xs mt-0.5">Booking revenue vs monthly overhead expenses</p>
          </div>
          <div className="flex-1 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff', borderRadius: '12px' }} />
                <Area type="monotone" name="Revenue (₹)" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" name="Expenses (₹)" dataKey="expenses" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DUES TRACKER (Right 1 col) */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 rounded-2xl flex flex-col shadow-xl">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white tracking-wide">Dues Tracker</h2>
            <p className="text-slate-400 text-xs mt-0.5">Urgent collection notifications</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-1">
            {dueBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center">
                <Clock className="stroke-[1.5] h-10 w-10 text-slate-600 mb-2 animate-pulse" />
                <p className="text-sm">No remaining dues found!</p>
                <p className="text-xs text-slate-600 mt-1">Excellent work capturing payments.</p>
              </div>
            ) : (
              dueBookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-900 hover:border-slate-800 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{b.customer_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{b.event_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-400">₹{Number(b.remaining_amount).toLocaleString('en-IN')}</p>
                    <Link href={`/bookings?edit=${b.id}`}>
                      <span className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center justify-end mt-1 cursor-pointer">
                        Collect <ChevronRight size={10} className="ml-0.5" />
                      </span>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* RECENT BOOKINGS LIST SECTION */}
      <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 rounded-2xl mt-8 shadow-xl">
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
              <p className="text-xs text-slate-600 mt-1">Get started by creating a new program and booking.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Client Name</th>
                  <th className="py-3 px-4">Event Date</th>
                  <th className="py-3 px-4">Service Category</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Dues Status</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-900/50">
                {recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white">
                      <div>
                        <p>{b.customer_name}</p>
                        <p className="text-xs text-slate-500 font-normal">{b.mobile_number}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{b.event_date}</td>
                    <td className="py-3.5 px-4 text-slate-400">
                      <span className="px-2.5 py-1 bg-slate-950/40 rounded-lg border border-slate-900 text-xs">
                        {b.program_name_snapshot || 'General Service'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-white font-semibold">₹{Number(b.total_amount).toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4">
                      {Number(b.remaining_amount) > 0 ? (
                        <span className="text-amber-400 font-semibold text-xs">
                          ₹{Number(b.remaining_amount).toLocaleString('en-IN')} pending
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold text-xs">Paid</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' :
                        b.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                        b.status === 'completed' ? 'bg-indigo-500/10 text-indigo-400' :
                        'bg-rose-500/10 text-rose-400'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
