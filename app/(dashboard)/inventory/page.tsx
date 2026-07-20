'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Package,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Activity,
  Wrench,
  Loader2,
  X,
  Save,
  Layers,
  Search
} from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'

interface InventoryItem {
  id: string
  name: string
  quantity: number
  status: string // 'available' | 'in_use' | 'repair'
  notes: string | null
  created_at: string
}

export default function InventoryPage() {
  const supabase = createClient()

  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Modal form states
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [status, setStatus] = useState('available')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchInventory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setItems(data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load inventory logs')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchInventory()

    // Postgres Realtime Sync
    const channel = supabase
      .channel('db-sync-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchInventory()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchInventory, supabase])

  const handleOpenNew = () => {
    setEditingItem(null)
    setName('')
    setQuantity('1')
    setStatus('available')
    setNotes('')
    setModalOpen(true)
  }

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setName(item.name)
    setQuantity(String(item.quantity))
    setStatus(item.status)
    setNotes(item.notes || '')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || Number(quantity) <= 0) {
      toast.error('Name and valid quantity are required')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthenticated')

      const payload = {
        name: name.trim(),
        quantity: Number(quantity),
        status,
        notes: notes.trim() || null
      }

      if (editingItem) {
        const { error } = await supabase
          .from('inventory')
          .update(payload)
          .eq('id', editingItem.id)

        if (error) throw error
        toast.success('Inventory item updated')
      } else {
        const { error } = await supabase
          .from('inventory')
          .insert({
            owner_id: user.id,
            ...payload
          })

        if (error) throw error
        toast.success('New inventory item added!')
      }

      setModalOpen(false)
      fetchInventory()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to save inventory item')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this inventory record?')) return

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Inventory item removed')
      fetchInventory()
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete item')
    }
  }

  // Calculate quick metrics
  const totalItemCount = items.reduce((acc, curr) => acc + curr.quantity, 0)
  const availableCount = items.filter(x => x.status === 'available').reduce((acc, curr) => acc + curr.quantity, 0)
  const inUseCount = items.filter(x => x.status === 'in_use').reduce((acc, curr) => acc + curr.quantity, 0)
  const repairCount = items.filter(x => x.status === 'repair').reduce((acc, curr) => acc + curr.quantity, 0)

  // Search filtering
  const filteredItems = items.filter(x =>
    x.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
        Loading inventory tracker...
      </div>
    )
  }

  return (
    <>
      <title>Inventory | Smart Booking Pro</title>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Package className="text-indigo-500" />
            Inventory Tracker
          </h1>
          <p className="text-slate-400 text-sm mt-1">Catalog equipment assets, manage counts, and flag hardware repair statuses.</p>
        </div>
        <div>
          <button
            onClick={handleOpenNew}
            className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/15 active:scale-95 cursor-pointer"
          >
            <Plus size={16} className="mr-2" />
            Add Item
          </button>
        </div>
      </div>

      {/* METRIC COUNTERS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Total catalog items */}
        <div className="bg-slate-900/30 border border-slate-900 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Units</p>
            <h4 className="text-xl font-bold text-white mt-1">{totalItemCount}</h4>
          </div>
          <Layers size={18} className="text-indigo-400 opacity-60" />
        </div>

        {/* Available items */}
        <div className="bg-slate-900/30 border border-slate-900 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Available</p>
            <h4 className="text-xl font-bold text-emerald-405 mt-1 text-emerald-400">{availableCount}</h4>
          </div>
          <CheckCircle2 size={18} className="text-emerald-400 opacity-60" />
        </div>

        {/* In Use */}
        <div className="bg-slate-900/30 border border-slate-900 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">In Use (Events)</p>
            <h4 className="text-xl font-bold text-sky-400 mt-1">{inUseCount}</h4>
          </div>
          <Activity size={18} className="text-sky-400 opacity-60" />
        </div>

        {/* In Repair */}
        <div className="bg-slate-900/30 border border-slate-900 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Under Repair</p>
            <h4 className="text-xl font-bold text-amber-500 mt-1">{repairCount}</h4>
          </div>
          <Wrench size={18} className="text-amber-500 opacity-60" />
        </div>
      </div>


      {/* SEARCH INPUT */}
      <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-4 rounded-2xl mb-6 shadow-xl relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-7 flex items-center pointer-events-none text-slate-500">
          <Search size={16} />
        </div>
        <input
          type="text"
          placeholder="Search equipment by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-slate-800 rounded-xl bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
        />
      </div>

      {/* INVENTORY TABLE/INDEX */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/20 border border-slate-900 rounded-2xl">
          <Package className="h-10 w-10 text-slate-700 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No items logged in tracker inventory.</p>
        </div>
      ) : (
        <div className="bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/30">
                  <th className="py-3.5 px-4">Equipment Description</th>
                  <th className="py-3.5 px-4 text-center">Owned Quantity</th>
                  <th className="py-3.5 px-4">Availability Status</th>
                  <th className="py-3.5 px-4">Tracker Remarks</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/50 text-sm">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {item.name}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                      {item.quantity}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.status === 'available' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        item.status === 'in_use' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                        'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {item.status === 'available' && <CheckCircle2 size={12} />}
                        {item.status === 'in_use' && <Activity size={12} />}
                        {item.status === 'repair' && <Wrench size={12} />}
                        {item.status === 'available' ? 'Available' : item.status === 'in_use' ? 'In Use' : 'Under Repair'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {item.notes || <span className="text-slate-600 font-normal italic">None</span>}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          title="Edit log"
                          className="p-2 rounded-lg bg-slate-950/40 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          title="Remove item"
                          className="p-2 rounded-lg bg-slate-950/40 hover:bg-rose-950/20 hover:border-rose-900/40 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE/EDIT MODAL OVERLAY */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/75 backdrop-blur-md select-none">
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white">
                {editingItem ? 'Edit Equipment Entry' : 'Add Inventory Equipment'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Equipment name */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Equipment Description / Model
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. JBL SRX828S Subwoofer"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm transition-all"
                />
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Owned Quantity Units
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Current Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/50 text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm cursor-pointer"
                >
                  <option value="available">Available (In Store)</option>
                  <option value="in_use">In Use (At Venue)</option>
                  <option value="repair">Under Repair (Maintenance)</option>
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Tracker Remarks / Remarks
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Serial #JBL-0012, needs new cone driver repair..."
                  rows={3}
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
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
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
