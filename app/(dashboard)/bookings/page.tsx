'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  FileSpreadsheet,
  FileDown,
  Loader2,
  X,
  Save,
  MapPin,
  Clock,
  AlertTriangle,
  Share2,
  Phone,
  Eye,
  Headphones
} from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'
import { downloadBookingPDF } from '@/components/bookings/BookingContract'


interface Booking {
  id: string
  customer_name: string
  mobile_number: string
  program_id: string | null
  program_name_snapshot: string | null
  event_date: string
  start_time: string | null
  end_time: string | null
  venue_address: string | null
  maps_link: string | null
  guest_count: number | null
  total_amount: number
  advance_amount: number
  remaining_amount: number
  status: string
  notes: string | null
  created_at: string
}

interface Program {
  id: string
  name: string
}

interface Profile {
  business_name: string
  business_address?: string
  gst_number?: string
}

const DEFAULT_PROGRAMS = [
  'DJ',
  'Tent House',
  'Catering',
  'Garden',
  'Birthday',
  'Wedding',
  'Anniversary',
  'Corporate Event',
  'Other'
]

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

export default function BookingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [profile, setProfile] = useState<Profile>({ business_name: 'My Business' })
  
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewBooking, setViewBooking] = useState<Booking | null>(null)

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Form Fields
  const [customerName, setCustomerName] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [programId, setProgramId] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [mapsLink, setMapsLink] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [totalAmount, setTotalAmount] = useState('0')
  const [advanceAmount, setAdvanceAmount] = useState('0')
  const [status, setStatus] = useState('pending')
  const [notes, setNotes] = useState('')

  // AM/PM time selector states
  const [startHour, setStartHour] = useState('')
  const [startMinute, setStartMinute] = useState('')
  const [startPeriod, setStartPeriod] = useState('AM')
  const [endHour, setEndHour] = useState('')
  const [endMinute, setEndMinute] = useState('')
  const [endPeriod, setEndPeriod] = useState('AM')

  // Custom Program Modal States
  const [customProgramModalOpen, setCustomProgramModalOpen] = useState(false)
  const [customProgramName, setCustomProgramName] = useState('')
  const [savingCustomProgram, setSavingCustomProgram] = useState(false)

  // Active dynamic PDF compilation trigger state
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null)

  // Conflict state
  const [conflictDetails, setConflictDetails] = useState<string | null>(null)
  const [hasConflict, setHasConflict] = useState(false)
  const [saving, setSaving] = useState(false)

  // Time conversion helpers
  const convertTo24Hour = (hour: string, minute: string, period: string) => {
    if (!hour || !minute) return null
    let h = parseInt(hour, 10)
    if (period === 'PM' && h < 12) h += 12
    if (period === 'AM' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${minute.padStart(2, '0')}:00`
  }

  const parse24Hour = (timeStr: string | null) => {
    if (!timeStr) return { hour: '', minute: '', period: 'AM' }
    const [hStr, mStr] = timeStr.split(':')
    let h = parseInt(hStr, 10)
    let period = 'AM'
    if (h >= 12) {
      period = 'PM'
      if (h > 12) h -= 12
    } else if (h === 0) {
      h = 12
    }
    return { hour: String(h), minute: mStr.substring(0, 2), period }
  }

  // 1. Fetching Data
  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Run bookings, programs, and profile queries in parallel with explicit column selections
      const [bookingsRes, programsRes, profileRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, customer_name, mobile_number, program_id, program_name_snapshot, event_date, start_time, end_time, venue_address, maps_link, guest_count, total_amount, advance_amount, remaining_amount, status, notes, created_at'),
        supabase
          .from('programs')
          .select('id, name'),
        supabase
          .from('profiles')
          .select('business_name, business_address, gst_number')
          .eq('id', user.id)
          .maybeSingle()
      ])

      if (bookingsRes.error) throw bookingsRes.error
      if (programsRes.error) throw programsRes.error

      const bookingsData = bookingsRes.data || []
      const programsData = programsRes.data || []
      let profileData = profileRes.data
      const profileError = profileRes.error

      if (!profileData && !profileError) {
        const defaultBusinessName = user.user_metadata?.business_name || 'My Business'
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({ id: user.id, business_name: defaultBusinessName })
          .select('business_name, business_address, gst_number')
          .maybeSingle()
        profileData = newProfile
      }

      // Auto sort bookings: nearest upcoming date first, if same date then earlier time first. Past dates go below upcoming.
      const getTodayStr = () => {
        const d = new Date()
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      const todayStr = getTodayStr()

      const sortedBookings = (bookingsData || []).sort((a: any, b: any) => {
        const isUpcomingA = a.event_date >= todayStr
        const isUpcomingB = b.event_date >= todayStr
        
        if (isUpcomingA && !isUpcomingB) return -1
        if (!isUpcomingA && isUpcomingB) return 1
        
        if (isUpcomingA && isUpcomingB) {
          // Upcoming: closest date first
          if (a.event_date !== b.event_date) {
            return a.event_date.localeCompare(b.event_date)
          }
          const timeA = a.start_time || '00:00:00'
          const timeB = b.start_time || '00:00:00'
          return timeA.localeCompare(timeB)
        } else {
          // Past: most recent past date first
          if (a.event_date !== b.event_date) {
            return b.event_date.localeCompare(a.event_date)
          }
          const timeA = a.start_time || '00:00:00'
          const timeB = b.start_time || '00:00:00'
          return timeA.localeCompare(timeB)
        }
      })

      setBookings(sortedBookings)
      setPrograms(programsData || [])
      if (profileData) setProfile(profileData)

    } catch (err) {
      console.error(err)
      toast.error('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()

    // Realtime listeners
    const channel = supabase
      .channel('db-sync-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData, supabase])

  // 2. Real-time Conflict checking logic (completely client-side using in-memory state)
  const checkConflicts = useCallback((date: string, start: string, end: string, excludeId?: string | null) => {
    if (!date) {
      setHasConflict(false)
      setConflictDetails(null)
      return
    }

    // Filter local bookings for the same date (excluding cancelled ones)
    const matches = bookings.filter((b) => b.event_date === date && b.status !== 'cancelled')

    if (matches.length === 0) {
      setHasConflict(false)
      setConflictDetails(null)
      return
    }

    const conflict = matches.find((b: any) => {
      if (excludeId && b.id === excludeId) return false
      if (!b.start_time || !b.end_time || !start || !end) {
        return true
      }
      return b.start_time < end && start < b.end_time
    })

    if (conflict) {
      setHasConflict(true)
      setConflictDetails(
        `Overlap Alert: Overlaps with "${conflict.customer_name}"` +
        (conflict.start_time ? ` (${format12HourTime(conflict.start_time)} - ${format12HourTime(conflict.end_time)})` : ' on same day')
      )
    } else {
      setHasConflict(false)
      setConflictDetails(null)
    }
  }, [bookings])

  // Conflict monitoring hook
  useEffect(() => {
    const start24 = convertTo24Hour(startHour, startMinute, startPeriod) || ''
    const end24 = convertTo24Hour(endHour, endMinute, endPeriod) || ''
    checkConflicts(eventDate, start24, end24, editingId)
  }, [eventDate, startHour, startMinute, startPeriod, endHour, endMinute, endPeriod, editingId, checkConflicts])

  // 3. Form launchers
  const handleOpenNew = () => {
    setEditingId(null)
    setCustomerName('')
    setMobileNumber('')
    setProgramId('')
    setEventDate('')
    setStartHour('')
    setStartMinute('')
    setStartPeriod('AM')
    setEndHour('')
    setEndMinute('')
    setEndPeriod('AM')
    setVenueAddress('')
    setMapsLink('')
    setGuestCount('')
    setTotalAmount('0')
    setAdvanceAmount('0')
    setStatus('pending')
    setNotes('')
    setHasConflict(false)
    setConflictDetails(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (b: Booking) => {
    setEditingId(b.id)
    setCustomerName(b.customer_name)
    setMobileNumber(b.mobile_number)
    setProgramId(b.program_id || b.program_name_snapshot || '')
    setEventDate(b.event_date)
    
    const startParsed = parse24Hour(b.start_time)
    setStartHour(startParsed.hour)
    setStartMinute(startParsed.minute)
    setStartPeriod(startParsed.period)

    const endParsed = parse24Hour(b.end_time)
    setEndHour(endParsed.hour)
    setEndMinute(endParsed.minute)
    setEndPeriod(endParsed.period)

    setVenueAddress(b.venue_address || '')
    setMapsLink(b.maps_link || '')
    setGuestCount(b.guest_count ? String(b.guest_count) : '')
    setTotalAmount(String(b.total_amount))
    setAdvanceAmount(String(b.advance_amount))
    setStatus(b.status)
    setNotes(b.notes || '')
    setModalOpen(true)
  }

  // Handle URL navigation triggers
  useEffect(() => {
    const isNew = searchParams.get('new') === 'true'
    const editId = searchParams.get('edit')
    if (isNew) {
      handleOpenNew()
    } else if (editId) {
      const b = bookings.find(x => x.id === editId)
      if (b) handleOpenEdit(b)
    }
  }, [searchParams, bookings])

  // Custom program creation save
  const handleSaveCustomProgram = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customProgramName.trim()) {
      toast.error('Program name is required')
      return
    }

    setSavingCustomProgram(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthenticated')

      const { data, error } = await supabase
        .from('programs')
        .insert({
          owner_id: user.id,
          name: customProgramName.trim(),
          icon: 'Sparkles'
        })
        .select()
        .single()

      if (error) throw error
      
      toast.success('Custom program added!')
      
      // Update dropdown lists
      const { data: programsData } = await supabase
        .from('programs')
        .select('id, name')
      setPrograms(programsData || [])

      setProgramId(data.id)
      setCustomProgramModalOpen(false)
      setCustomProgramName('')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to add custom program')
    } finally {
      setSavingCustomProgram(false)
    }
  }

  // Save Booking Submit Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName || !mobileNumber || !eventDate) {
      toast.error('Name, mobile number, and event date are required')
      return
    }

    const start24 = convertTo24Hour(startHour, startMinute, startPeriod)
    const end24 = convertTo24Hour(endHour, endMinute, endPeriod)

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthenticated')

      // Resolve program details
      let progName = 'General Service'
      let finalProgramId = null

      if (DEFAULT_PROGRAMS.includes(programId)) {
        progName = programId
      } else {
        const selectedProg = programs.find(p => p.id === programId)
        if (selectedProg) {
          progName = selectedProg.name
          finalProgramId = selectedProg.id
        }
      }

      const totalVal = Number(totalAmount) || 0
      const advVal = Number(advanceAmount) || 0

      const payload = {
        customer_name: customerName.trim(),
        mobile_number: mobileNumber.trim(),
        program_id: finalProgramId,
        program_name_snapshot: progName,
        event_date: eventDate,
        start_time: start24,
        end_time: end24,
        venue_address: venueAddress.trim() || null,
        maps_link: mapsLink.trim() || null,
        guest_count: guestCount ? Number(guestCount) : null,
        total_amount: totalVal,
        advance_amount: advVal,
        status,
        notes: notes.trim() || null
      }

      if (editingId) {
        const { error } = await supabase
          .from('bookings')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error
        toast.success('Booking updated')
      } else {
        const { error } = await supabase
          .from('bookings')
          .insert({
            owner_id: user.id,
            ...payload
          })

        if (error) throw error
        toast.success('Booking created successfully')
      }

      setModalOpen(false)
      router.replace('/bookings')
      fetchData()

    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to save booking')
    } finally {
      setSaving(false)
    }
  }

  // Delete booking handler
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Booking removed')
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete booking')
    }
  }

  // Excel spreadsheet exporter
  const handleExportExcel = async () => {
    if (bookings.length === 0) {
      toast.error('No booking records to export')
      return
    }

    try {
      const XLSX = await import('xlsx')

      const data = bookings.map((b) => ({
        'Client Name': b.customer_name,
        'Mobile Number': b.mobile_number,
        'Service / Program': b.program_name_snapshot || 'General',
        'Event Date': formatIndianDate(b.event_date),
        'Start Time': b.start_time ? format12HourTime(b.start_time) : '',
        'End Time': b.end_time ? format12HourTime(b.end_time) : '',
        'Venue Address': b.venue_address || '',
        'Guest Count': b.guest_count || '',
        'Total Price (INR)': b.total_amount,
        'Advance Paid (INR)': b.advance_amount,
        'Balance Dues (INR)': b.remaining_amount,
        'Booking Status': b.status,
        'Notes': b.notes || ''
      }))

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Bookings')
      XLSX.writeFile(wb, `Mookin_Bookings_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Excel spreadsheet generated!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate Excel spreadsheet')
    }
  }

  // WhatsApp Share receipt formatter
  const handleShareWhatsApp = (b: Booking) => {
    const formattedDate = formatIndianDate(b.event_date)
    const formattedTime = b.start_time && b.end_time 
      ? `${format12HourTime(b.start_time)} - ${format12HourTime(b.end_time)}`
      : b.start_time 
      ? format12HourTime(b.start_time)
      : 'Not specified'
    const venue = b.venue_address || 'Not specified'
    const bizName = profile?.business_name || 'My Business'
    const notesStr = b.notes ? `*Special Notes:*\n${b.notes}\n\n` : ''

    const text = `*BOOKING CONFIRMATION*\n` +
      `----------------------------------------\n` +
      `*Business:* ${bizName}\n` +
      `*Client:* ${b.customer_name}\n` +
      `*Program:* ${b.program_name_snapshot || 'General'}\n` +
      `*Date:* ${formattedDate}\n` +
      `*Time:* ${formattedTime}\n` +
      `*Venue:* ${venue}\n\n` +
      `*Billing Summary:*\n` +
      `- Total Amount: ₹${Number(b.total_amount).toLocaleString('en-IN')}\n` +
      `- Advance Paid: ₹${Number(b.advance_amount).toLocaleString('en-IN')}\n` +
      `- *Balance Due: ₹${Number(b.remaining_amount).toLocaleString('en-IN')}*\n\n` +
      notesStr +
      `*Terms & Conditions:*\n` +
      `1. All payment receipts must be validated with authorized signatory.\n` +
      `2. The advance booking amount is non-refundable in the case of last-minute event cancellations.\n` +
      `3. Outstanding balance dues must be cleared on the event date before performance start.\n\n` +
      `Thank you for choosing ${bizName}!`

    const cleanedMobile = b.mobile_number.replace(/\D/g, '')
    const whatsappPhone = cleanedMobile.length === 10 ? `91${cleanedMobile}` : cleanedMobile
    const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  // Filter computation memoized
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        b.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.mobile_number.includes(searchTerm)
      
      const matchesStatus =
        statusFilter === 'all' || b.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [bookings, searchTerm, statusFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
        Loading bookings...
      </div>
    )
  }

  return (
    <>
      <title>Bookings | Smart Booking Pro</title>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Calendar className="text-indigo-500" />
            Bookings Manager
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage events, track advances, check schedule overlaps, and download contracts.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer animate-none"
          >
            <FileSpreadsheet size={16} className="mr-2 text-emerald-400" />
            Excel
          </button>
          <button
            onClick={handleOpenNew}
            className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/15 active:scale-95 cursor-pointer font-bold animate-none"
          >
            <Plus size={16} className="mr-2" />
            Add Booking
          </button>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-4 rounded-2xl flex flex-col md:flex-row gap-4 mb-6 shadow-xl">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search by client name or mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-800 rounded-xl bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
          />
        </div>

        <div className="flex gap-2 items-center">
          <Filter size={16} className="text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block px-3 py-2 border border-slate-800 rounded-xl bg-slate-950/40 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* BOOKINGS TABLE / CARDS */}
      {filteredBookings.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/20 border border-slate-900 rounded-2xl">
          <Calendar className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No booking records found.</p>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/30">
                    <th className="py-3.5 px-4">Client Name</th>
                    <th className="py-3.5 px-4">Event Date & Time</th>
                    <th className="py-3.5 px-4">Service Package</th>
                    <th className="py-3.5 px-4">Billing Summary</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50">
                  {filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-white">{b.customer_name}</p>
                          <p className="text-xs text-slate-450">{b.mobile_number}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col text-slate-300">
                          <span className="font-medium">{formatIndianDate(b.event_date)}</span>
                          {b.start_time && b.end_time ? (
                            <span className="text-xs text-slate-500 mt-0.5 flex items-center">
                              <Clock size={12} className="mr-1" /> {format12HourTime(b.start_time)} - {format12HourTime(b.end_time)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 mt-0.5">Time unspecified</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {b.venue_address ? (
                          <div className="text-xs text-slate-400 flex flex-col gap-1">
                            <span className="px-2 py-0.5 bg-slate-950/50 rounded border border-slate-850 self-start text-indigo-400">
                              {b.program_name_snapshot || 'General'}
                            </span>
                            <span className="flex items-center text-slate-500 truncate max-w-[200px]">
                              <MapPin size={10} className="mr-1 shrink-0" /> {b.venue_address}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-950/50 rounded border border-slate-850 text-xs text-slate-500">
                            {b.program_name_snapshot || 'General'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-sm">
                          <p className="text-white font-semibold">₹{Number(b.total_amount).toLocaleString('en-IN')}</p>
                          {Number(b.remaining_amount) > 0 ? (
                            <p className="text-[10px] text-amber-500 font-semibold mt-0.5">
                              ₹{Number(b.remaining_amount).toLocaleString('en-IN')} due
                            </p>
                          ) : (
                            <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">Paid In Full</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          b.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          b.status === 'completed' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                          'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 animate-none">
                          <button
                            onClick={() => {
                              toast.promise(
                                downloadBookingPDF(b as any, profile),
                                {
                                  loading: 'Generating PDF Invoice...',
                                  success: 'PDF Invoice downloaded successfully!',
                                  error: 'Failed to generate PDF'
                                }
                              )
                            }}
                            title="Download PDF Invoice"
                            className="p-2 rounded-lg bg-slate-950/40 hover:bg-slate-800 border border-slate-850 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <FileDown size={14} className="text-indigo-400" />
                          </button>

                          <button
                            onClick={() => handleShareWhatsApp(b)}
                            title="Share Booking via WhatsApp"
                            className="p-2 rounded-lg bg-slate-950/40 hover:bg-emerald-950/30 hover:border-emerald-900 border border-slate-850 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <Share2 size={14} className="text-emerald-450" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(b)}
                            title="Edit booking"
                            className="p-2 rounded-lg bg-slate-950/40 hover:bg-slate-800 border border-slate-850 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(b.id)}
                            title="Delete booking"
                            className="p-2 rounded-lg bg-slate-950/40 hover:bg-rose-950/20 hover:border-rose-900/40 border border-slate-850 text-slate-400 hover:text-rose-450 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARD VIEW (REPLACE TABLE COMPLETELY ON MOBILE) */}
          <div className="block md:hidden space-y-4">
            {filteredBookings.map((b) => {
              // Extract initials for the customer avatar badge
              const initials = b.customer_name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || '👤'

              // Clean digits for communication links
              const cleanedMobile = b.mobile_number.replace(/\D/g, '')
              const phoneLink = `tel:${cleanedMobile}`
              const whatsappLink = `https://wa.me/${cleanedMobile.length === 10 ? '91' + cleanedMobile : cleanedMobile}`
              const mapsLink = b.venue_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.venue_address)}` : null

              return (
                <div key={b.id} className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 shadow-lg w-full">
                  {/* 1. Customer Section */}
                  <div className="flex items-center justify-between gap-4 bg-slate-950/20 p-4 rounded-xl border border-slate-800/40">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Avatar initials badge */}
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-655 to-indigo-400 border border-indigo-500/30 flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-md">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-white leading-snug break-words tracking-tight">{b.customer_name}</h4>
                        <p className="text-xs text-slate-400 break-all font-medium mt-0.5">{b.mobile_number}</p>
                      </div>
                    </div>

                    {/* Quick Dial and Chat triggers */}
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={phoneLink}
                        title="Call Customer"
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400 hover:text-white hover:bg-slate-850 hover:border-slate-700 transition-all flex items-center justify-center cursor-pointer active:scale-95 shadow-sm"
                      >
                        <Phone size={15} />
                      </a>
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noreferrer"
                        title="WhatsApp Chat"
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:text-white hover:bg-slate-850 hover:border-slate-700 transition-all flex items-center justify-center cursor-pointer active:scale-95 shadow-sm"
                      >
                        <Share2 size={15} />
                      </a>
                    </div>
                  </div>

                  {/* 2. Event Section (Group together: Date, Time, Package with equal spacing) */}
                  <div className="flex flex-col gap-3 bg-slate-950/20 p-4 rounded-xl border border-slate-800/40">
                    <div className="flex items-center gap-3 text-slate-300">
                      <Calendar size={15} className="text-indigo-400 shrink-0" />
                      <span className="text-sm font-semibold text-slate-200">
                        {formatIndianDate(b.event_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-300">
                      <Clock size={15} className="text-indigo-400 shrink-0" />
                      <span className="text-sm font-medium text-slate-200">
                        {b.start_time && b.end_time 
                          ? `${format12HourTime(b.start_time)} - ${format12HourTime(b.end_time)}`
                          : 'Time unspecified'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-300">
                      <Headphones size={15} className="text-indigo-400 shrink-0" />
                      <span className="text-sm font-bold text-indigo-400 uppercase tracking-wide">
                        {b.program_name_snapshot || 'General'}
                      </span>
                    </div>
                  </div>

                  {/* 3. Venue Section */}
                  <div className="flex flex-col gap-2.5 bg-slate-950/20 p-4 rounded-xl border border-slate-800/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Venue Location</span>
                      {mapsLink && (
                        <a
                          href={mapsLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-white font-semibold transition-colors cursor-pointer"
                        >
                          <MapPin size={11} />
                          <span>Navigate</span>
                        </a>
                      )}
                    </div>
                    <div className="bg-slate-900/50 border border-slate-850 p-3 rounded-xl text-xs break-words leading-relaxed text-slate-300">
                      {b.venue_address || 'Not specified'}
                    </div>
                  </div>

                  {/* 4. Payment Section (Three Equal Cards) */}
                  <div className="grid grid-cols-3 gap-3 w-full">
                    <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850 flex flex-col justify-between items-center text-center min-h-[72px]">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">TOTAL</span>
                      <span className="text-white font-extrabold text-sm mt-1.5">₹{Number(b.total_amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850 flex flex-col justify-between items-center text-center min-h-[72px]">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ADVANCE</span>
                      <span className="text-slate-300 font-semibold text-sm mt-1.5">₹{Number(b.advance_amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850 flex flex-col justify-between items-center text-center min-h-[72px]">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">BALANCE</span>
                      <span className={`font-extrabold text-sm mt-1.5 ${Number(b.remaining_amount) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        ₹{Number(b.remaining_amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* 5. Status Section (Vertically centered premium pill badge) */}
                  <div className="flex items-center justify-center p-1">
                    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-extrabold tracking-wide uppercase border ${
                      b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      b.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      b.status === 'completed' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {b.status}
                    </span>
                  </div>

                  {/* 6. Actions Section (Equal width, height, and spacing grid) */}
                  <div className="grid grid-cols-4 gap-2 w-full animate-none">
                    <button
                      onClick={() => setViewBooking(b)}
                      title="View details"
                      className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-800 border border-slate-800 text-indigo-400 hover:text-white transition-colors cursor-pointer text-[11px] font-bold h-12 w-full active:scale-95"
                    >
                      <Eye size={14} className="shrink-0" />
                      <span>View</span>
                    </button>

                    <button
                      onClick={() => handleOpenEdit(b)}
                      title="Edit booking"
                      className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer text-[11px] font-bold h-12 w-full active:scale-95"
                    >
                      <Edit2 size={14} className="text-slate-400 shrink-0" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => {
                        toast.promise(
                          downloadBookingPDF(b as any, profile),
                          {
                            loading: 'Generating PDF...',
                            success: 'PDF downloaded!',
                            error: 'Failed to generate PDF'
                          }
                        )
                      }}
                      title="Download PDF Invoice"
                      className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-800 border border-slate-800 text-indigo-400 hover:text-white transition-colors cursor-pointer text-[11px] font-bold h-12 w-full active:scale-95"
                    >
                      <FileDown size={14} className="shrink-0" />
                      <span>Invoice</span>
                    </button>

                    <button
                      onClick={() => handleDelete(b.id)}
                      title="Delete booking"
                      className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-950/40 hover:bg-rose-950/20 hover:border-rose-900/40 border border-slate-800 text-rose-400 hover:text-rose-350 transition-colors cursor-pointer text-[11px] font-bold h-12 w-full active:scale-95"
                    >
                      <Trash2 size={14} className="shrink-0" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* VIEW BOOKING DETAIL MODAL OVERLAY */}
      {viewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto py-8 select-none">
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white">Event Booking Details</h3>
              <button
                onClick={() => setViewBooking(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto text-sm">
              {/* Client Info */}
              <div className="space-y-1">
                <span className="text-xs text-slate-500 uppercase font-semibold">Client Name</span>
                <p className="text-white text-base font-bold">{viewBooking.customer_name}</p>
                <p className="text-slate-400 font-medium">{viewBooking.mobile_number}</p>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold block mb-1">Event Date</span>
                  <p className="text-slate-200 font-medium">{formatIndianDate(viewBooking.event_date)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold block mb-1">Event Time</span>
                  <p className="text-slate-200 font-medium">
                    {viewBooking.start_time && viewBooking.end_time
                      ? `${format12HourTime(viewBooking.start_time)} - ${format12HourTime(viewBooking.end_time)}`
                      : 'Time unspecified'}
                  </p>
                </div>
              </div>

              {/* Package & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold block mb-1">Service Package</span>
                  <span className="inline-block px-2.5 py-0.5 bg-slate-950/50 rounded border border-slate-850 text-indigo-400 font-semibold text-xs">
                    {viewBooking.program_name_snapshot || 'General'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold block mb-1">Status</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    viewBooking.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    viewBooking.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    viewBooking.status === 'completed' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                    'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {viewBooking.status}
                  </span>
                </div>
              </div>

              {/* Venue Address */}
              {viewBooking.venue_address && (
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Location / Venue Address</span>
                  <p className="text-slate-300 leading-relaxed break-words">{viewBooking.venue_address}</p>
                </div>
              )}

              {/* Billing Info */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Price</span>
                  <p className="text-white font-bold text-sm mt-0.5">₹{Number(viewBooking.total_amount).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Paid Advance</span>
                  <p className="text-emerald-400 font-bold text-sm mt-0.5">₹{Number(viewBooking.advance_amount).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Remaining Due</span>
                  <p className="text-amber-400 font-bold text-sm mt-0.5">₹{Number(viewBooking.remaining_amount).toLocaleString('en-IN')}</p>
                </div>
              </div>

              {/* Special Notes */}
              {viewBooking.notes && (
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Notes / Special Instructions</span>
                  <p className="text-slate-400 leading-relaxed bg-slate-950/20 p-3 rounded-lg border border-slate-850 break-words">{viewBooking.notes}</p>
                </div>
              )}
            </div>

            <div className="h-16 border-t border-slate-800 px-6 flex items-center justify-end bg-slate-950/20">
              <button
                onClick={() => setViewBooking(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors text-sm cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE/EDIT BOOKING DIALOG OVERLAY */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto py-8 select-none">
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white">
                {editingId ? 'Edit Event Booking' : 'Log New Event Booking'}
              </h3>
              <button
                onClick={() => {
                  setModalOpen(false)
                  router.replace('/bookings')
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              
              {/* Overlap warnings banner */}
              {hasConflict && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 text-amber-400 animate-pulse">
                  <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                  <div className="text-xs">
                    <p className="font-bold">Overlapping Schedule Alert</p>
                    <p className="mt-0.5 text-slate-300">{conflictDetails}</p>
                  </div>
                </div>
              )}

              {/* GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Customer name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  />
                </div>

                {/* Mobile number */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  />
                </div>

                {/* Program Category Dropdown Selection */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Service Category</label>
                  <select
                    value={programId}
                    onChange={(e) => {
                      if (e.target.value === 'ADD_CUSTOM_PROGRAM') {
                        setCustomProgramModalOpen(true)
                      } else {
                        setProgramId(e.target.value)
                      }
                    }}
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm cursor-pointer"
                  >
                    <option value="">Choose Service Category</option>
                    <optgroup label="Default Services">
                      {DEFAULT_PROGRAMS.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </optgroup>
                    {programs.length > 0 && (
                      <optgroup label="Custom Services">
                        {programs.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </optgroup>
                    )}
                    <option value="ADD_CUSTOM_PROGRAM" className="text-indigo-455 font-bold">
                      + Add Custom Program
                    </option>
                  </select>
                </div>

                {/* Event date */}
                <div className="space-y-1.5 relative">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                    Event Date
                    {hasConflict && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping ml-2" />}
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                </div>

                {/* Start Time Dropdown Selectors */}
                <div className="space-y-1.5 col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Start Time</label>
                  <div className="flex gap-2">
                    <select
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      className="block w-full px-2 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
                    >
                      <option value="">Hr</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      value={startMinute}
                      onChange={(e) => setStartMinute(e.target.value)}
                      className="block w-full px-2 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
                    >
                      <option value="">Min</option>
                      {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={startPeriod}
                      onChange={(e) => setStartPeriod(e.target.value)}
                      className="block w-full px-2 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* End Time Dropdown Selectors */}
                <div className="space-y-1.5 col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">End Time</label>
                  <div className="flex gap-2">
                    <select
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                      className="block w-full px-2 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
                    >
                      <option value="">Hr</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      value={endMinute}
                      onChange={(e) => setEndMinute(e.target.value)}
                      className="block w-full px-2 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
                    >
                      <option value="">Min</option>
                      {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={endPeriod}
                      onChange={(e) => setEndPeriod(e.target.value)}
                      className="block w-full px-2 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* Venue Address */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Venue Address</label>
                  <input
                    type="text"
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                    placeholder="e.g. Royal Palace Garden, Sector 12"
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  />
                </div>

                {/* Maps link */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Google Maps Link</label>
                  <input
                    type="url"
                    value={mapsLink}
                    onChange={(e) => setMapsLink(e.target.value)}
                    placeholder="e.g. https://maps.google.com/?q=..."
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  />
                </div>

                {/* Guest Count */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Guest Count</label>
                  <input
                    type="number"
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    placeholder="e.g. 500"
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                </div>

                {/* Booking Status */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-slate-350 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm cursor-pointer"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Total amount */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Price (INR)</label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                </div>

                {/* Advance paid */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Advance Paid (INR)</label>
                  <input
                    type="number"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>

              {/* Computed outstanding Dues */}
              <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-400">Balance Due Outstanding:</span>
                <span className="text-lg font-black text-indigo-400">
                  ₹{(Math.max(0, (Number(totalAmount) || 0) - (Number(advanceAmount) || 0))).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Notes / Details</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specify DJ tracks, helper demands, stage dimension requirements..."
                  rows={3}
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              {/* Form Footer Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false)
                    router.replace('/bookings')
                  }}
                  className="px-4 py-2 border border-slate-800 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-slate-950/20 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/15 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold"
                >
                  {saving ? (
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  ) : (
                    <Save className="-ml-1 mr-2 h-4 w-4" />
                  )}
                  Save Booking
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ADD CUSTOM PROGRAM MODAL OVERLAY */}
      {customProgramModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-md select-none animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="h-14 flex items-center justify-between px-5 border-b border-slate-800">
              <h4 className="font-bold text-white text-sm">Add Custom Service Program</h4>
              <button
                type="button"
                onClick={() => setCustomProgramModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveCustomProgram} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-bold">Program / Service Name</label>
                <input
                  type="text"
                  required
                  value={customProgramName}
                  onChange={(e) => setCustomProgramName(e.target.value)}
                  placeholder="e.g. Laser Light Show"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-805">
                <button
                  type="button"
                  onClick={() => setCustomProgramModalOpen(false)}
                  className="px-4 py-2 border border-slate-850 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-950/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomProgram}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 active:scale-95 disabled:opacity-50"
                >
                  {savingCustomProgram ? 'Saving...' : 'Add Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
