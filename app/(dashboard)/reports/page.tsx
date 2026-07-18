'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart3,
  Calendar,
  IndianRupee,
  TrendingUp,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  TrendingDown
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts'
import { toast, Toaster } from 'react-hot-toast'

interface Booking {
  id: string
  customer_name: string
  mobile_number: string
  event_date: string
  total_amount: number
  advance_amount: number
  remaining_amount: number
  status: string
  program_name_snapshot: string | null
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export default function ReportsPage() {
  const supabase = createClient()
  
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'monthly' | 'yearly'>('monthly')
  
  // Date filter states
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  
  const currentYear = new Date().getFullYear()
  const yearsRange = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i) // range from 3 years ago to 3 years from now

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, customer_name, mobile_number, event_date, total_amount, advance_amount, remaining_amount, status, program_name_snapshot')
      
      if (error) throw error
      setBookings(data || [])
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Precompute monthly filtered bookings and statistics
  const monthlyStats = useMemo(() => {
    const data = bookings.filter(b => {
      const bDate = new Date(b.event_date)
      return bDate.getMonth() === selectedMonth && bDate.getFullYear() === selectedYear
    })
    
    const completed = data.filter(b => b.status === 'completed').length
    const pending = data.filter(b => b.status === 'pending').length
    const confirmed = data.filter(b => b.status === 'confirmed').length
    const cancelled = data.filter(b => b.status === 'cancelled').length

    const financial = data.filter(b => b.status !== 'cancelled')
    const revenue = financial.reduce((sum, b) => sum + Number(b.total_amount), 0)
    const advance = financial.reduce((sum, b) => sum + Number(b.advance_amount), 0)
    const balance = financial.reduce((sum, b) => sum + Number(b.remaining_amount), 0)

    return {
      monthlyData: data,
      totalMonthlyBookings: data.length,
      completedMonthly: completed,
      pendingMonthly: pending,
      confirmedMonthly: confirmed,
      cancelledMonthly: cancelled,
      monthlyRevenue: revenue,
      monthlyAdvance: advance,
      monthlyBalance: balance
    }
  }, [bookings, selectedMonth, selectedYear])

  // Precompute yearly filtered bookings and statistics
  const yearlyStats = useMemo(() => {
    const data = bookings.filter(b => {
      const bDate = new Date(b.event_date)
      return bDate.getFullYear() === selectedYear
    })

    const financial = data.filter(b => b.status !== 'cancelled')
    const revenue = financial.reduce((sum, b) => sum + Number(b.total_amount), 0)
    const advance = financial.reduce((sum, b) => sum + Number(b.advance_amount), 0)
    const balance = financial.reduce((sum, b) => sum + Number(b.remaining_amount), 0)

    return {
      yearlyData: data,
      totalYearlyBookings: data.length,
      yearlyRevenue: revenue,
      yearlyAdvance: advance,
      yearlyBalance: balance
    }
  }, [bookings, selectedYear])

  // Extract variables for easy template references
  const {
    monthlyData,
    totalMonthlyBookings,
    completedMonthly,
    pendingMonthly,
    confirmedMonthly,
    cancelledMonthly,
    monthlyRevenue,
    monthlyAdvance,
    monthlyBalance
  } = monthlyStats

  const {
    yearlyData,
    totalYearlyBookings,
    yearlyRevenue,
    yearlyAdvance,
    yearlyBalance
  } = yearlyStats

  // Precompute chart data (12 months breakdown)
  const chartData = useMemo(() => {
    return MONTHS_SHORT.map((label, idx) => {
      const monthBookings = yearlyData.filter(b => {
        const d = new Date(b.event_date)
        return d.getMonth() === idx
      })
      
      const revenue = monthBookings
        .filter(b => b.status !== 'cancelled')
        .reduce((sum, b) => sum + Number(b.total_amount), 0)
        
      const bookingsCount = monthBookings.length

      return {
        name: label,
        'Revenue (₹)': revenue,
        'Bookings': bookingsCount
      }
    })
  }, [yearlyData])

  // Export stats to Excel
  const handleExportExcel = async () => {
    const dataToExport = activeTab === 'monthly' ? monthlyData : yearlyData
    if (dataToExport.length === 0) {
      toast.error('No records available for export')
      return
    }

    const title = activeTab === 'monthly' 
      ? `Report_${MONTHS[selectedMonth]}_${selectedYear}`
      : `Report_Year_${selectedYear}`

    const formattedRows = dataToExport.map(b => ({
      'Client Name': b.customer_name,
      'Mobile Number': b.mobile_number,
      'Service/Program': b.program_name_snapshot || 'General',
      'Event Date': b.event_date,
      'Total Amount (₹)': b.total_amount,
      'Advance Paid (₹)': b.advance_amount,
      'Remaining Balance (₹)': b.remaining_amount,
      'Status': b.status
    }))

    const summaryRow = activeTab === 'monthly' ? {
      'Client Name': 'MONTHLY TOTALS',
      'Mobile Number': `Revenue: ₹${monthlyRevenue}`,
      'Service/Program': `Advance: ₹${monthlyAdvance}`,
      'Event Date': `Balance: ₹${monthlyBalance}`,
      'Total Amount (₹)': monthlyRevenue,
      'Advance Paid (₹)': monthlyAdvance,
      'Remaining Balance (₹)': monthlyBalance,
      'Status': `Total Bookings: ${totalMonthlyBookings}`
    } : {
      'Client Name': 'YEARLY TOTALS',
      'Mobile Number': `Revenue: ₹${yearlyRevenue}`,
      'Service/Program': `Advance: ₹${yearlyAdvance}`,
      'Event Date': `Balance: ₹${yearlyBalance}`,
      'Total Amount (₹)': yearlyRevenue,
      'Advance Paid (₹)': yearlyAdvance,
      'Remaining Balance (₹)': yearlyBalance,
      'Status': `Total Bookings: ${totalYearlyBookings}`
    }

    try {
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet([...formattedRows, {}, summaryRow])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Report Sheet')
      XLSX.writeFile(wb, `${title}.xlsx`)
      toast.success('Spreadsheet exported successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to export report')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
        Generating reports...
      </div>
    )
  }

  return (
    <>
      <title>Reports | Smart Booking Pro</title>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="text-indigo-500" />
            Financial & Bookings Reports
          </h1>
          <p className="text-slate-400 text-sm mt-1">Review business growth metrics, revenue summaries, and track bookings aggregations.</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer self-start"
        >
          <FileSpreadsheet size={16} className="mr-2 text-emerald-400" />
          Export Report
        </button>
      </div>

      {/* TABS & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/30 backdrop-blur-md border border-slate-900 p-4 rounded-2xl mb-8 shadow-xl">
        <div className="flex bg-slate-950/40 p-1.5 rounded-xl border border-slate-850 self-start">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'monthly'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Monthly Report
          </button>
          <button
            onClick={() => setActiveTab('yearly')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'yearly'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Yearly Report
          </button>
        </div>

        <div className="flex gap-3 items-center">
          <Calendar size={16} className="text-slate-500" />
          
          {activeTab === 'monthly' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border border-slate-800 rounded-xl bg-slate-950/40 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm cursor-pointer"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          )}

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border border-slate-800 rounded-xl bg-slate-950/40 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm cursor-pointer"
          >
            {yearsRange.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* METRICS CARDS */}
      {activeTab === 'monthly' ? (
        <>
          {/* Monthly Report Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Bookings</p>
              <h3 className="text-3xl font-black text-white mt-2">{totalMonthlyBookings}</h3>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Logged for {MONTHS[selectedMonth]}
              </p>
            </div>

            <div className="bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/5 blur-xl pointer-events-none" />
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Completed / Confirmed</p>
              <h3 className="text-3xl font-black text-emerald-400 mt-2">
                {completedMonthly} <span className="text-xs font-normal text-slate-500">/</span> {confirmedMonthly}
              </h3>
              <div className="text-xs text-slate-400 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> {pendingMonthly} pending</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> {cancelledMonthly} cancelled</span>
              </div>
            </div>

            <div className="bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                <span>Revenue (Est.)</span>
                <TrendingUp size={14} className="text-indigo-400" />
              </p>
              <h3 className="text-3xl font-black text-white mt-2">₹{monthlyRevenue.toLocaleString('en-IN')}</h3>
              <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Excludes cancelled bookings
              </p>
            </div>

            <div className="bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-amber-500/5 blur-xl pointer-events-none" />
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                <span>Advance / Balance</span>
                <TrendingDown size={14} className="text-amber-500" />
              </p>
              <h3 className="text-3xl font-black text-white mt-2">
                ₹{monthlyAdvance.toLocaleString('en-IN')}
              </h3>
              <p className="text-xs text-amber-500 mt-2 font-medium">
                ₹{monthlyBalance.toLocaleString('en-IN')} outstanding
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Yearly Report Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Yearly Bookings</p>
              <h3 className="text-3xl font-black text-white mt-2">{totalYearlyBookings}</h3>
              <p className="text-xs text-slate-400 mt-2">All booking records in {selectedYear}</p>
            </div>

            <div className="bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                <span>Total Income / Revenue</span>
                <TrendingUp size={14} className="text-indigo-400" />
              </p>
              <h3 className="text-3xl font-black text-white mt-2">₹{yearlyRevenue.toLocaleString('en-IN')}</h3>
              <p className="text-xs text-indigo-400 mt-2">Based on non-cancelled packages</p>
            </div>

            <div className="bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-amber-500/5 blur-xl pointer-events-none" />
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Advance vs Balance</p>
              <h3 className="text-3xl font-black text-white mt-2">
                ₹{yearlyAdvance.toLocaleString('en-IN')}
              </h3>
              <p className="text-xs text-amber-500 mt-2 font-medium">
                ₹{yearlyBalance.toLocaleString('en-IN')} outstanding
              </p>
            </div>
          </div>

          {/* Yearly Chart Panel */}
          <div className="bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl mb-8">
            <h3 className="text-lg font-bold text-white mb-6">Monthly Revenue & Bookings Breakdown ({selectedYear})</h3>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000) + 'k' : v}`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area yAxisId="left" type="monotone" dataKey="Revenue (₹)" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area yAxisId="right" type="monotone" dataKey="Bookings" stroke="#10b981" strokeWidth={2} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* FILTERED BOOKINGS LIST DETAILS */}
      <div className="bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-5 border-b border-slate-900">
          <h3 className="font-bold text-lg text-white">
            {activeTab === 'monthly' 
              ? `Bookings in ${MONTHS[selectedMonth]} ${selectedYear}`
              : `Bookings in the Year ${selectedYear}`
            }
          </h3>
        </div>

        {activeTab === 'monthly' ? (
          monthlyData.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-8 w-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No bookings recorded for this month.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/30">
                    <th className="py-3 px-6">Client Name</th>
                    <th className="py-3 px-6">Event Date</th>
                    <th className="py-3 px-6">Package Name</th>
                    <th className="py-3 px-6">Total Amount</th>
                    <th className="py-3 px-6">Advance Paid</th>
                    <th className="py-3 px-6">Balance Due</th>
                    <th className="py-3 px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50">
                  {monthlyData.map(b => (
                    <tr key={b.id} className="hover:bg-slate-900/10 transition-colors text-sm text-slate-300">
                      <td className="py-4 px-6 font-bold text-white">{b.customer_name}</td>
                      <td className="py-4 px-6">
                        {new Date(b.event_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2 py-0.5 bg-slate-950/50 rounded border border-slate-850 text-xs text-indigo-400">
                          {b.program_name_snapshot || 'General'}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-semibold">₹{Number(b.total_amount).toLocaleString('en-IN')}</td>
                      <td className="py-4 px-6">₹{Number(b.advance_amount).toLocaleString('en-IN')}</td>
                      <td className="py-4 px-6">
                        {Number(b.remaining_amount) > 0 ? (
                          <span className="text-amber-500 font-semibold">₹{Number(b.remaining_amount).toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-emerald-400 font-semibold">Paid</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          b.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          b.status === 'completed' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                          'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          yearlyData.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-8 w-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No bookings recorded for this year.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/30">
                    <th className="py-3 px-6">Client Name</th>
                    <th className="py-3 px-6">Event Date</th>
                    <th className="py-3 px-6">Package Name</th>
                    <th className="py-3 px-6">Total Amount</th>
                    <th className="py-3 px-6">Advance Paid</th>
                    <th className="py-3 px-6">Balance Due</th>
                    <th className="py-3 px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50">
                  {yearlyData.map(b => (
                    <tr key={b.id} className="hover:bg-slate-900/10 transition-colors text-sm text-slate-300">
                      <td className="py-4 px-6 font-bold text-white">{b.customer_name}</td>
                      <td className="py-4 px-6">
                        {new Date(b.event_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2 py-0.5 bg-slate-950/50 rounded border border-slate-850 text-xs text-indigo-400">
                          {b.program_name_snapshot || 'General'}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-semibold">₹{Number(b.total_amount).toLocaleString('en-IN')}</td>
                      <td className="py-4 px-6">₹{Number(b.advance_amount).toLocaleString('en-IN')}</td>
                      <td className="py-4 px-6">
                        {Number(b.remaining_amount) > 0 ? (
                          <span className="text-amber-500 font-semibold">₹{Number(b.remaining_amount).toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-emerald-400 font-semibold">Paid</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          b.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          b.status === 'completed' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                          'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </>
  )
}
