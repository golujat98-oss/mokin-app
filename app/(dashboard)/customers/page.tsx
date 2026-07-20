'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Phone,
  MessageCircle,
  Search,
  X,
  Save,
  Loader2,
  Calendar,
  AlertCircle
} from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'

const formatWhatsAppDate = (dateStr: string) => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const year = parts[0]
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[monthIdx]} ${day}, ${year}`
}

interface Customer {
  id: string
  name: string
  mobile_number: string
  notes: string | null
  created_at: string
}

interface Booking {
  customer_id: string
  event_date: string
  status: string
  program_name_snapshot: string | null
}

export default function CustomersPage() {
  const supabase = createClient()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [name, setName] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      // Run queries in parallel with explicit column selectors
      const [custRes, bookRes] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, mobile_number, notes')
          .order('name', { ascending: true }),
        supabase
          .from('bookings')
          .select('customer_id, event_date, status, program_name_snapshot')
          .neq('status', 'cancelled')
      ])

      if (custRes.error) throw custRes.error
      if (bookRes.error) throw bookRes.error

      setCustomers(custRes.data || [])
      setBookings(bookRes.data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load customers catalog')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    setMounted(true)
    fetchData()

    // Realtime Postgres sync
    const channel = supabase
      .channel('db-sync-customers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData, supabase])

  const handleOpenNew = () => {
    setEditingCustomer(null)
    setName('')
    setMobileNumber('')
    setNotes('')
    setModalOpen(true)
  }

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c)
    setName(c.name)
    setMobileNumber(c.mobile_number)
    setNotes(c.notes || '')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !mobileNumber.trim()) {
      toast.error('Name and mobile number are required')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthenticated')

      const payload = {
        name: name.trim(),
        mobile_number: mobileNumber.trim(),
        notes: notes.trim() || null
      }

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', editingCustomer.id)

        if (error) throw error
        toast.success('Customer updated')
      } else {
        const { error } = await supabase
          .from('customers')
          .insert({
            owner_id: user.id,
            ...payload
          })

        if (error) throw error
        toast.success('New customer created!')
      }

      setModalOpen(false)
      fetchData()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer? Related bookings will be retained but customer association will be unlinked.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Customer deleted')
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete customer')
    }
  }

  // Precompute closest upcoming booking for each customer
  const upcomingBookingsMap = useMemo(() => {
    const map: Record<string, Booking> = {}
    const today = new Date().toISOString().split('T')[0]
    
    // Group bookings by customer_id
    const grouped: Record<string, Booking[]> = {}
    bookings.forEach(b => {
      if (!b.customer_id) return
      if (!grouped[b.customer_id]) {
        grouped[b.customer_id] = []
      }
      grouped[b.customer_id].push(b)
    })
    
    // Find closest booking for each customer
    Object.entries(grouped).forEach(([customerId, custBookings]) => {
      custBookings.sort((a, b) => a.event_date.localeCompare(b.event_date))
      const upcoming = custBookings.find(b => b.event_date >= today)
      map[customerId] = upcoming || custBookings[0]
    })
    
    return map
  }, [bookings])

  // Get closest upcoming booking for a customer from precomputed map
  const getCustomerEventInfo = useCallback((customerId: string) => {
    return upcomingBookingsMap[customerId] || null
  }, [upcomingBookingsMap])

  // Generate customized WhatsApp url template
  const getWhatsAppLink = (customer: Customer) => {
    const eventInfo = getCustomerEventInfo(customer.id)
    let message = `Hello ${customer.name}, this is regarding your booking arrangements.`

    if (eventInfo) {
      const dateStr = formatWhatsAppDate(eventInfo.event_date)
      const serviceName = eventInfo.program_name_snapshot || 'event service'
      message = `Hello ${customer.name}, this is regarding your upcoming ${serviceName} booking scheduled on ${dateStr}. Please let us know if you need to coordinate any setup details. Thanks!`
    }

    // Clean mobile number (only keep digits, wa.me expects country code like 91)
    let cleanedNum = customer.mobile_number.replace(/\D/g, '')
    // Default to prefix 91 if length is 10 digits (India)
    if (cleanedNum.length === 10) {
      cleanedNum = '91' + cleanedNum
    }

    return `https://wa.me/${cleanedNum}?text=${encodeURIComponent(message)}`
  }

  const getPhoneCallLink = (mobile: string) => {
    let cleanedNum = mobile.replace(/\D/g, '')
    if (cleanedNum.length === 10) {
      cleanedNum = '91' + cleanedNum
    }
    return `tel:${cleanedNum}`
  }

  // Search filtering memoized
  const filteredCustomers = useMemo(() => {
    return customers.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile_number.includes(searchTerm)
    )
  }, [customers, searchTerm])

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
        Loading customer index...
      </div>
    )
  }

  return (
    <>
      <title>Customers | Smart Booking Pro</title>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Users className="text-indigo-500" />
            Customers Database
          </h1>
          <p className="text-slate-400 text-sm mt-1">Directory of client contacts, general notes, closest bookings, and chat triggers.</p>
        </div>
        <div>
          <button
            onClick={handleOpenNew}
            className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/15 active:scale-95 cursor-pointer"
          >
            <Plus size={16} className="mr-2" />
            Add Customer
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-4 rounded-2xl mb-6 shadow-xl relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-7 flex items-center pointer-events-none text-slate-500">
          <Search size={16} />
        </div>
        <input
          type="text"
          placeholder="Search customers by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-slate-800 rounded-xl bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
        />
      </div>


      {/* CUSTOMERS CARDS GRID */}
      {filteredCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 bg-slate-950/20 border border-white/[0.04] rounded-[24px] p-6 shadow-inner relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-indigo-500/[0.02] blur-2xl pointer-events-none" />
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 shadow-sm animate-pulse">
            <Users size={28} className="stroke-[1.8]" />
          </div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">No customer records found</h3>
          <p className="text-sm text-slate-400 max-w-sm mt-2 leading-relaxed font-medium">
            Create new client accounts to track event programs, coordinate schedules, and manage billing contracts seamlessly.
          </p>
          <button
            onClick={handleOpenNew}
            className="mt-6 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-md shadow-indigo-600/15 active:scale-95 cursor-pointer"
          >
            <Plus size={14} className="stroke-[2.5]" /> Add Your First Customer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((customer) => {
            const eventInfo = getCustomerEventInfo(customer.id)
            return (
              <div
                key={customer.id}
                className="bg-slate-900/30 backdrop-blur-md border border-slate-900 hover:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-extrabold text-white tracking-wide">{customer.name}</h3>
                      <p className="text-xs sm:text-sm text-slate-400 font-semibold mt-0.5">{customer.mobile_number}</p>
                    </div>
                    {/* Action icons */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenEdit(customer)}
                        className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                        title="Edit details"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id)}
                        className="p-1.5 rounded hover:bg-rose-950/20 text-slate-400 hover:text-rose-400"
                        title="Delete customer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Customer General Notes */}
                  {customer.notes ? (
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/30 p-2.5 rounded-lg border border-slate-950/60 mb-4 truncate max-h-[50px] font-medium">
                      {customer.notes}
                    </p>
                  ) : (
                    <div className="h-4" />
                  )}

                  {/* Booking Date indicator */}
                  {eventInfo ? (
                    <div className="flex items-center gap-2 p-2 bg-indigo-500/5 rounded-xl border border-indigo-500/10 mb-4 text-slate-300">
                      <Calendar size={13} className="text-indigo-400 shrink-0" />
                      <span className="text-xs truncate">
                        Closest booking: <span className="font-semibold text-white">{eventInfo.event_date}</span> ({eventInfo.program_name_snapshot})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-slate-950/20 rounded-xl border border-slate-900/60 mb-4 text-slate-400">
                      <AlertCircle size={13} className="shrink-0" />
                      <span className="text-xs">No active event bookings logged</span>
                    </div>
                  )}
                </div>

                {/* Direct Action Triggers */}
                <div className="grid grid-cols-2 gap-3 border-t border-slate-900/80 pt-4 mt-2">
                  <a
                    href={getPhoneCallLink(customer.mobile_number)}
                    className="flex items-center justify-center py-2.5 border border-slate-800 rounded-xl text-xs font-semibold text-slate-350 bg-slate-955/20 hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
                  >
                    <Phone size={13} className="mr-2 text-indigo-400" />
                    Call Client
                  </a>
                  <a
                    href={getWhatsAppLink(customer)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center py-2.5 border border-slate-800 rounded-xl text-xs font-semibold text-slate-350 bg-slate-955/20 hover:bg-emerald-950/10 hover:border-emerald-900/40 hover:text-emerald-400 transition-all cursor-pointer min-h-[44px]"
                  >
                    <MessageCircle size={13} className="mr-2 text-emerald-400" />
                    WhatsApp
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE/EDIT MODAL OVERLAY */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/75 backdrop-blur-md select-none">
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white">
                {editingCustomer ? 'Edit Customer Details' : 'Add New Customer'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Client name */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Client Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Anand Sharma"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm transition-all"
                />
              </div>

              {/* Mobile number */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  required
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm transition-all"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  General Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Regular corporate client, demands clean setups..."
                  rows={3}
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-slate-950/20 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-600/15 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  ) : (
                    <Save className="-ml-1 mr-2 h-4 w-4" />
                  )}
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
